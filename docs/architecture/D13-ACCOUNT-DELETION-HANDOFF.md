# D13 — Account deletion IdP + session revoke handoff

| Field | Value |
| --- | --- |
| Mode | **Thiết kế** (docs-only) — Role `architect` · `docs/agents/roles/architect.md` |
| Issue | [#344](https://github.com/hangndat/ticket-solution/issues/344) |
| Parent | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · Story [#305](https://github.com/hangndat/ticket-solution/issues/305) · findings from Task [#320](https://github.com/hangndat/ticket-solution/issues/320) / PR [#342](https://github.com/hangndat/ticket-solution/pull/342) |
| Source SHA read (impl baseline) | **`8bc744e0c765db6e073628b35941115872d7af5b`** |
| Handoff tip (this doc) | **see git tip of PR [#346](https://github.com/hangndat/ticket-solution/pull/346)** — revalidate after each docs commit |
| Prior design tip | `3271aee2c837bc885aeb9850b6d504ae545d77a6` (superseded by this revision) |
| Review evidence | [PR comment 6247253660](https://github.com/hangndat/ticket-solution/pull/342#issuecomment-6247253660) · `docs/reviews/D13-PR342-DOD-SECURITY.md` (SEC-1 / SEC-2) |
| Apple primary (browsed) | [Offering account deletion in your app — 5.1.1(v)](https://developer.apple.com/support/offering-account-deletion-in-your-app/) (2026-10-18) |
| Architecture impact | **Có** — auth trust boundary + durable retry for erasure spanning PostgreSQL ↔ Keycloak |
| O06 | **Không đổi số** (anonymize / IdP erase ≤30d; audit TTL 730d; ticket/object stubs out of scope) |
| Kết luận | **Đủ để triển khai trong scope** — §8 decisions **đã chốt** bởi coordinator |
| Related | SEC-1 BE [#345](https://github.com/hangndat/ticket-solution/issues/345) **đang chạy**; iOS account-deletion copy tip `c70631dd46d956b3b89917a12668970732800466` (main) |

## 0. Coordinator decisions (chốt — 2026-10-18)

| # | Decision | Status |
| --- | --- | --- |
| D1 | **SEC-1** Option A + R1+R2 (revoke SECURITY DEFINER tại ACK **và** apply idempotent) — **độc lập** IdP | **Confirmed** → BE #345 |
| D2 | **Không** thêm public `state` enum (`ANONYMIZING`, …). Giữ `REQUESTED` + **internal durable flags**; `COMPLETED` **chỉ** khi PG anonymize **và** IdP **DELETE** thành công (hoặc confirmed absence) | **Confirmed** |
| D3 | **Không** chấp nhận **I1 disable-only** làm full account deletion / store compliance | **Confirmed** |
| D4 | Chọn **I2 DELETE** Keycloak user trong SLA O06 **≤30d**. Disable/logout chỉ **phase tạm** fail-closed — **không** `idp_status=SUCCEEDED` / **không** `COMPLETED` chỉ vì disable | **Confirmed** |
| D5 | Issuer cho Admin/erase = **allowlist cố định** từ server config (verified OIDC issuer). Map `sub` → Keycloak userId **chỉ** qua issuer đó; **không** lookup/delete theo email/username mơ hồ; **không** SSRF issuer từ client input | **Confirmed** |
| D6 | JWT cũ / re-login fail-closed qua open deletion + tombstone digest; minimal retention khớp O06 — không giữ original PII vô hạn sau delete | **Confirmed** |

**Ambiguity (không tự quyết legal):** Apple yêu cầu xóa account record + associated personal data trừ phần “legally required to maintain”. O06 đã chốt giữ audit 730d và anonymize app ≤30d — **không** mở lại số đó ở đây. Counsel ngoài scope; handoff neo O06 + 5.1.1(v) primary text.

## 1. Mục tiêu / non-goals

### Mục tiêu (đóng blocker store)

1. **SEC-1:** Sau ACK/apply, không còn `staff_sessions` ACTIVE cho user → Gate `assertSessionActive` fail-closed.
2. **SEC-2:** Xóa user Keycloak (I2) trong ≤30d; chặn recreate app user từ cùng OIDC `(issuer, sub)` (tombstone + upsert deny); không đánh dấu xong chỉ vì disable.

### Non-goals

- Không đổi số O06 / retention ticket 365d / object 90d / audit 730d.
- Không `DELETE` `audit_logs` / `platform_audit_logs`.
- Không thêm SaaS IdP; không BullMQ; không rewrite Gate/OIDC toàn hệ.
- Không sửa `apps/**` / lockfile / shared OpenAPI trong Task architect.
- Không deploy prod / mutate prod DB / commit secrets.
- Không tự reviewer/merge.

## 2. Hiện trạng @ source SHA (facts)

| Fact | Location |
| --- | --- |
| ACK → `REQUESTED` + O06 policy | `packages/backend/src/account-deletion.ts` |
| Worker → `processDueAccountAnonymizations` | `apps/worker/src/index.ts` |
| Apply: clear email, rotate `subject`→`anon:<requestId>`, revoke `device_tokens`, attendees email null, `COMPLETED` | migration `202610180001_d12_o06_account_anonymize` |
| **Chưa** revoke `staff_sessions` (tại baseline; BE #345 đang sửa) | same apply |
| Gate trusts ACTIVE `(tenant, event, session, user_id)` | `gate.ts` `assertSessionActive` |
| Upsert identity = unique `(issuer, subject)` | `users.ts` `upsertFromVerifiedIdentity` |
| Subject rotate → same OIDC sub **creates new user** | platform test @ baseline |
| No Keycloak Admin in worker/API @ baseline | — |
| Tenant `outbox` (ADR-17) | **không** dùng cho IdP user-global job |

## 3. Invariants / trust boundaries

1. PostgreSQL = SoT cho deletion business state; Keycloak = IdP side-effect với durable retry trên cùng request row.
2. Deletion ACK chỉ qua OIDC verified bearer (`selfActor`); deny-by-default.
3. Cross-tenant session revoke = SECURITY DEFINER `migration_owner` (+ owner policy nếu FORCE RLS) — pattern `event_attendees_owner`.
4. **Issuer allowlist:** chỉ `OIDC_ISSUER` / allowlist server config đã verify JWKS. Admin base URL + realm path **cố định config** — không lấy issuer/URL từ JWT `iss` chưa allowlist, không từ body client.
5. **IdP identity key:** `(allowlisted_issuer, oidc_sub)` → resolve Keycloak user **by id / exact sub attribute** theo contract realm đã biết. **Cấm** search-delete by email hoặc username fuzzy.
6. Audit retain 730d; sanitized IdP errors (no token/secret/PII).
7. Multi-instance workers: **lease** trên request row trước IdP call (tránh concurrent DELETE).

## 4. SEC-1 — Stale `staff_sessions` (**confirmed**)

### 4.1 Choice

**A + R1+R2:** helper `revoke_sessions_for_user(p_user_id)` SECURITY DEFINER; gọi tại ACK và lại trong apply (idempotent). Soft-check trong `assertSessionActive` only = **không đủ**.

### 4.2 Status

- Design đủ triển khai; **BE #345 đang chạy** — không block IdP design.
- Consumers: Gate paths; store honesty về privileged access sau delete.

### 4.3 Impl paths (BE-S1)

Migration + `account-deletion.ts` ACK hook; tests `platform.test.cjs` / `gate.test.cjs` (session → ACK → `SESSION_NOT_ACTIVE`). Optional: deny `openStaffSession` khi open `REQUESTED`.

## 5. SEC-2 — Keycloak DELETE (I2) + app fail-closed

### 5.1 Apple 5.1.1(v) — primary (không suy diễn)

Browse: https://developer.apple.com/support/offering-account-deletion-in-your-app/

Trích yêu cầu (paraphrase + neo wording):

- Apps hỗ trợ **account creation** phải cho phép **initiate deletion** trong app.
- “Offer to delete the **entire account record**, along with associated personal data.”
- “**only offering to temporarily deactivate or disable an account is insufficient.**”
- Deletion không bắt buộc immediate nếu thông báo thời gian hợp lý + confirmation khi xong; tuân local law / counsel riêng.

**Hệ quả design:** **Không** dùng câu “disable ≈ account không dùng lại” làm evidence compliance App Store. Disable/logout chỉ **tạm** để fail-closed trong cửa sổ ≤30d; **completion / SUCCEEDED / COMPLETED** đòi hỏi **DELETE** IdP user (hoặc **confirmed user absence** — xem §5.5), cộng PG anonymize.

### 5.2 So sánh phương án (đã chốt)

| | **I1 — Disable only** | **I2 — DELETE IdP user (chốt)** | **I3 — Tombstone app only** |
| --- | --- | --- | --- |
| Semantics | `enabled=false` | `DELETE …/users/{id}` trong ≤30d | Chặn upsert; IdP account còn |
| vs 5.1.1(v) | **Insufficient** nếu chỉ vậy (Apple primary) | Khớp “delete account record” phía IdP | Insufficient một mình |
| Role trong MVP | **Phase tạm** sau PG scrub / trước hoặc song song retry DELETE — **không** đóng job | **Đích erasure** | Defense-in-depth **cùng** I2 |
| Recovery | Re-enable dễ | Khó (chấp nhận) | — |

**Chốt: I2.** I1 = optional immediate harden (logout + disable) **trước** DELETE trong cùng pipeline; status riêng (`idp_disable_at` optional) **≠** success terminal.

### 5.3 Public state vs internal flags (**confirmed**)

**Public `state` enum giữ nguyên:** `REQUESTED` | `UNDER_REVIEW` | `AWAITING_POLICY` | `COMPLETED` | `REJECTED`.

**Không** thêm `ANONYMIZING` (tránh đụng `account_deletion_one_open` + clients).

Internal columns trên `account_deletion_requests` (đề xuất tối thiểu):

| Column | Ý |
| --- | --- |
| `pg_applied_at timestamptz` | PG scrub+rotate+session revoke xong |
| `original_issuer text` NULL | Snapshot tạm cho job IdP — **scrub sau COMPLETED** (hoặc ngay khi có tombstone digest) |
| `original_subject text` NULL | Snapshot tạm — **scrub** như trên |
| `subject_tombstone_digest bytea/text` | `HMAC/SHA-256(allowlisted_issuer \|\| sub \|\| server_pepper)` — **không** lưu sub plaintext dài hạn |
| `idp_lease_owner text` / `idp_lease_expires_at` | Multi-instance lease trước Admin call |
| `idp_status text` | `PENDING` \| `DISABLED_PENDING_DELETE` \| `DELETED` \| `NOT_FOUND` \| `FAILED` |
| `idp_attempts int` / `idp_next_attempt_at` | Bounded backoff |
| `idp_last_error_code text` | Sanitized enum/code only |

**Terminal success:** `state=COMPLETED` **iff** `pg_applied_at IS NOT NULL` **AND** `idp_status IN ('DELETED','NOT_FOUND')`.

- `DISABLED_PENDING_DELETE` / `FAILED` / `PENDING` → **stay `REQUESTED`** (open unique vẫn giữ một open row).
- **Không** map disable → `SUCCEEDED` / `COMPLETED`.

### 5.4 Tombstone / PII retention (O06-aligned)

| Data | Retention |
| --- | --- |
| `subject_tombstone_digest` | Giữ để fail-closed upsert/JWT map; **không** chứa original sub. TTL: tối thiểu đến hết nhu cầu chống recreate; **đề xuất** align cửa sổ dài hơn anonymize nếu cần chống replay — **không** tự kéo audit 730d; nếu chỉ cần chống re-login sau delete, giữ digest **đến khi** policy bảo mật hiện hành cho identity denylist (ghi rõ trong impl: pepper rotated = digest vô hiệu → chấp nhận theo ops). **Ambiguity:** exact digest TTL vs 730d — **không** tự đổi O06; đề xuất mặc định **giữ digest** trên row COMPLETED (không phải email/sub plaintext) cho đến khi có ADR riêng. |
| `original_issuer` / `original_subject` | Chỉ phục vụ job DELETE; **NULL/scrub khi** `idp_status=DELETED|NOT_FOUND` và trước/at `COMPLETED` |
| Audit logs | Không đụng — TTL 730d O06 |
| Email trên `users` | Đã null sau PG scrub |

JWT access token cũ: API verify chữ ký vẫn pass đến hết hạn nếu chỉ rotate subject — **bắt buộc** deny path: open `REQUESTED` cho `user_id` **hoặc** tombstone digest match trên `(issuer, sub)` từ token **sau** verify chữ ký + allowlist issuer. Membership/Gate đã revoke session; attendee tokens: rely existing authz + deletion checks trên `/me/*`.

### 5.5 Ordering / failure matrix (I2)

```text
ACK REQUESTED → revoke sessions (SEC-1)
Worker (lease IdP row):
  if pg_applied_at is null:
    snapshot issuer/sub (allowlisted issuer only)
    write tombstone digest
    PG scrub + rotate + revoke sessions
    set pg_applied_at
    optional: Keycloak logout + disable → idp_status=DISABLED_PENDING_DELETE
       (KHÔNG COMPLETED)
  claim lease → DELETE user by Keycloak id resolved from (issuer, sub)
  DELETE 204/404-confirmed-absence → idp_status=DELETED|NOT_FOUND
       scrub original_* ; state=COMPLETED ; release lease
  retryable errors → FAILED + backoff ; stay REQUESTED
```

| IdP HTTP / case | Classification | Next |
| --- | --- | --- |
| 204 / 200 delete | `DELETED` | COMPLETED (if PG done) |
| 404 trên **user resource** sau resolve id thành công trước đó, hoặc GET-by-id 404 **sau** allowlisted realm path đúng | `NOT_FOUND` (confirmed absence) | COMPLETED |
| 404 / 5xx trên **token/realm/admin base path** sai config | Config/path error — **không** `NOT_FOUND` | `FAILED`; escalate ops; **không** COMPLETED |
| 401/403 Admin | Creds/RBAC — non-retry without fix | `FAILED`; escalate |
| 409 / transient 5xx / timeout | Retryable | backoff |
| Disable-only success | `DISABLED_PENDING_DELETE` | continue DELETE attempts |

### 5.6 Resolve Keycloak userId (no fuzzy identity)

1. Verify JWT với JWKS của **allowlisted issuer** (đã có API path).
2. Worker đọc snapshot `(original_issuer, original_subject)` chỉ nếu `original_issuer` ∈ allowlist config.
3. Admin API base = `KEYCLOAK_BASE_URL` + fixed realm (e.g. `ticket`) from config — **không** parse host từ issuer string tùy ý nếu khác allowlist mapping table.
4. Resolve: `GET /admin/realms/{realm}/users/{id}` nếu sub == Keycloak id **hoặc** exact query `q=username:` **chỉ khi** realm contract đảm bảo username≡sub (ghi rõ trong ops); ưu tiên **User Federation / protocol mapper** đã pin `sub` = Keycloak user id. Nếu không chắc mapping → **blocker ops** trước prod enable erasure (báo ambiguity mapping, không đoán email).
5. `DELETE /admin/realms/{realm}/users/{id}`.

### 5.7 Least privilege + multi-instance

| Item | Spec |
| --- | --- |
| Client | `vemoki-erasure` confidential; roles tối thiểu delete/manage-users (+ view để GET-by-id). Không `realm-admin` |
| Secret | **Worker-only** env; never API process; never commit |
| Lease | `UPDATE … SET idp_lease_owner, idp_lease_expires_at WHERE lease expired OR owner=self` trước Admin call; short TTL (e.g. 30–60s) reclaim |
| Errors | Store codes like `IDP_TIMEOUT`, `IDP_HTTP_503`, `IDP_PATH_404`, `IDP_USER_404`, `IDP_FORBIDDEN` — no body dump |

### 5.8 Consumers

| Consumer | Blocked until |
| --- | --- |
| Store deletion release gate | SEC-1 merged + SEC-2 I2 COMPLETED semantics live |
| BE-S2 IdP delete Task | This handoff (now unblocked) |
| Ops Keycloak erasure client | Before prod enable |
| SEC-1 / BE #345 | **Not** blocked on SEC-2 |

## 6. End-to-end sequence (MVP chốt)

```text
POST /v1/me/account-deletion-requests
  → REQUESTED + O06 policy
  → revoke_sessions_for_user
  → deny openStaffSession if open deletion (recommended)

Worker due list: state=REQUESTED AND policy set AND due
  → lease + PG apply flags (no public enum change)
  → optional disable/logout (non-terminal)
  → DELETE IdP user (terminal IdP success)
  → scrub original_*; COMPLETED

upsertFromVerifiedIdentity / API after JWT verify
  → reject if open REQUESTED for user OR tombstone digest hit
```

## 7. Regression test matrix (BE-S2 + SEC-1 overlap)

| # | Case | Expect |
| --- | --- | --- |
| T1–T3 | Session revoke ACK/apply; audit retained; idempotent apply | SEC-1 (BE #345) |
| T4 | IdP DELETE success → `DELETED` + `COMPLETED` | |
| T5 | Confirmed user 404 → `NOT_FOUND` + `COMPLETED` | |
| T6 | Admin/realm path 404 → `FAILED`, **not** COMPLETED | |
| T7 | Disable-only → `DISABLED_PENDING_DELETE`, state stays `REQUESTED` | |
| T8 | 503 then DELETE | stays open until DELETE/NOT_FOUND |
| T9 | Re-login / upsert same sub while REQUESTED or after COMPLETED | reject |
| T10 | Expired JWT still signed | reject via tombstone/open deletion after verify |
| T11 | Two workers | only one holds lease; no double DELETE panic (second 404 OK) |
| T12 | Fuzzy email delete attempted | **not implemented** / test asserts API helper rejects |
| T13 | Issuer not on allowlist | no Admin call |
| T14 | `original_*` scrubbed after COMPLETED | plaintext absent |
| T15 | Fake IdP adapter in tests | no real Keycloak required |

## 8. Quyết định — trạng thái

| # | Was open | Now |
| --- | --- | --- |
| SEC-1 A+R1+R2 | Đề xuất | **Confirmed** (BE #345) |
| No new public enum; flags + COMPLETED=both | Đề xuất | **Confirmed** |
| I1 vs I2 | Đề xuất I1 | **Rejected I1-as-done; chốt I2 DELETE** |
| Tombstone | columns vs table | **Digest column + scrub `original_*`** (confirmed direction) |
| openStaffSession deny | Đề xuất | **Recommended** with SEC-1 |

## 9. Handoff ownership

| Task | Ownership | Deps |
| --- | --- | --- |
| **BE-S1** session revoke | `backend` #345 | Running |
| **BE-S2** IdP DELETE + flags + upsert/JWT deny + lease | `backend` · `packages/backend` · `apps/worker` | This doc tip |
| **Ops** Keycloak client + sub↔userId contract | coordinator/ops | Before prod erasure |
| **BA/ASC** (optional) | `product-ba` | After BE-S2 — copy must not claim disable-only |
| DoD/security | independent sessions | After impl SHAs |

### Paths (impl SEC-2)

- `packages/backend/prisma/migrations/*` (columns + lease; no public enum widen unless required for CHECK on `idp_status` only)
- `packages/backend/src/account-deletion.ts`
- `packages/backend/src/users.ts` (+ API identity gate)
- `packages/backend/src/keycloak-erasure.ts` (new)
- `apps/worker/src/index.ts`
- tests + `.env.example` placeholders

## 10. Kết luận

| Hạng mục | Status |
| --- | --- |
| SEC-1 | **Confirmed / implementing** (#345) |
| SEC-2 | **Đủ để triển khai** — I2 DELETE ≤30d; disable non-terminal; no public enum; allowlist issuer; tombstone digest; lease |
| Compliance evidence | Neo Apple primary “disable insufficient”; **không** dùng “≈ không dùng lại” |
| Verdict | **Đủ để triển khai trong scope** — spawn/continue BE-S2; DoD độc lập sau |

**Blocked until SEC-2:** store full account-deletion release gate (IdP record still exists).  
**Unblocked:** BE-S2 coding từ tip handoff này; SEC-1 parallel.
