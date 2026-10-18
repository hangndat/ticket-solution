# D13 — Account deletion IdP + session revoke handoff

| Field | Value |
| --- | --- |
| Mode | **Thiết kế** (docs-only) — Role `architect` · `docs/agents/roles/architect.md` |
| Issue | [#344](https://github.com/hangndat/ticket-solution/issues/344) |
| Parent | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · Story [#305](https://github.com/hangndat/ticket-solution/issues/305) · findings from Task [#320](https://github.com/hangndat/ticket-solution/issues/320) / PR [#342](https://github.com/hangndat/ticket-solution/pull/342) |
| Source SHA read (impl baseline) | **`8bc744e0c765db6e073628b35941115872d7af5b`** |
| Prior tip (FAIL review) | **`ab3f3c48a788cf6927026f573e42918ae48c12ef`** — `docs/reviews/D13-PR346-DOD-SECURITY.md` (R1–R5) |
| Handoff tip (this doc) | **see git tip of PR [#346](https://github.com/hangndat/ticket-solution/pull/346)** — independent reviewer **revalidate** after this revision |
| Review evidence | [PR comment 6247253660](https://github.com/hangndat/ticket-solution/pull/342#issuecomment-6247253660) · `docs/reviews/D13-PR342-DOD-SECURITY.md` · `docs/reviews/D13-PR346-DOD-SECURITY.md` |
| Apple primary (browsed) | [Offering account deletion in your app — 5.1.1(v)](https://developer.apple.com/support/offering-account-deletion-in-your-app/) (2026-10-18) |
| Architecture impact | **Có** — auth trust boundary + durable retry for erasure spanning PostgreSQL ↔ Keycloak |
| O06 | **Không đổi số** (anonymize / IdP erase ≤30d; audit TTL 730d; ticket/object stubs out of scope) — denylist TTL **không** kế thừa 730d |
| Kết luận | **Đủ để triển khai trong scope** — §0 / §5.4 R1–R5 **đã chốt**; BE-S2 không được invent retention |
| Related | SEC-1 BE [#345](https://github.com/hangndat/ticket-solution/issues/345) / PR [#348](https://github.com/hangndat/ticket-solution/pull/348) (**apply-only** revoke — ACK gap riêng); iOS account-deletion copy tip `c70631dd46d956b3b89917a12668970732800466` (main) |

## 0. Coordinator decisions (chốt — 2026-10-18)

| # | Decision | Status |
| --- | --- | --- |
| D1 | **SEC-1** Option A + R1+R2 (revoke SECURITY DEFINER tại ACK **và** apply idempotent) — **độc lập** IdP | **Confirmed** → BE #345; **gap:** PR #348 hiện apply-only — ACK path vẫn thiếu nếu chưa merge ACK hook (xem §4.4) |
| D2 | **Không** thêm public `state` enum (`ANONYMIZING`, …). Giữ `REQUESTED` + **internal durable flags**; `COMPLETED` **chỉ** khi PG anonymize **và** IdP **DELETE** thành công (hoặc confirmed absence) | **Confirmed** |
| D3 | **Không** chấp nhận **I1 disable-only** làm full account deletion / store compliance | **Confirmed** |
| D4 | Chọn **I2 DELETE** Keycloak user trong SLA O06 **≤30d**. Disable/logout chỉ **phase tạm** fail-closed — **không** `idp_status=SUCCEEDED` / **không** `COMPLETED` chỉ vì disable | **Confirmed** |
| D5 | Issuer cho Admin/erase = **allowlist cố định** từ server config (verified OIDC issuer). Map `sub` → Keycloak userId **chỉ** qua issuer đó; **không** lookup/delete theo email/username mơ hồ; **không** SSRF issuer từ client input | **Confirmed** |
| D6 | JWT cũ / re-login fail-closed qua open deletion + **bounded** tombstone digest; minimal retention — **không** giữ original PII vô hạn; **không** silent kéo O06 audit 730d sang denylist | **Confirmed** (TTL cụ thể = **R1**) |
| D7 | Privacy denylist R1–R5 (§5.4) — reject indefinite retention + unsafe pepper-drop | **Confirmed** (revision sau FAIL @ `ab3f3c48…`) |

**Ambiguity (không tự quyết legal):** Apple yêu cầu xóa account record + associated personal data trừ phần “legally required to maintain”. O06 đã chốt giữ audit 730d và anonymize app ≤30d — **không** mở lại số đó ở đây. Counsel ngoài scope; handoff neo O06 + 5.1.1(v) primary text.

## 1. Mục tiêu / non-goals

### Mục tiêu (đóng blocker store)

1. **SEC-1:** Sau ACK/apply, không còn `staff_sessions` ACTIVE cho user → Gate `assertSessionActive` fail-closed.
2. **SEC-2:** Xóa user Keycloak (I2) trong ≤30d; chặn recreate app user từ cùng OIDC `(issuer, sub)` trong cửa sổ denylist bounded; không đánh dấu xong chỉ vì disable.

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
| **Chưa** revoke `staff_sessions` (tại baseline; BE #345 / PR #348 đang sửa apply-path) | same apply |
| Gate trusts ACTIVE `(tenant, event, session, user_id)` | `gate.ts` `assertSessionActive` |
| Upsert identity = unique `(issuer, subject)` | `users.ts` `upsertFromVerifiedIdentity` |
| Subject rotate → same OIDC sub **creates new user** | platform test @ baseline |
| OIDC verify: `jose.jwtVerify` issuer+audience+alg; **không** `maxTokenAge` | `packages/backend/src/oidc.ts` · `platform-oidc.ts` @ baseline |
| Realm export `infra/keycloak/realm-ticket.json` | **không** chứa `accessTokenLifespan` / SSO timeouts (không giả định max từ file này) |
| No Keycloak Admin in worker/API @ baseline | — |
| Tenant `outbox` (ADR-17) | **không** dùng cho IdP user-global job |

## 3. Invariants / trust boundaries

1. PostgreSQL = SoT cho deletion business state; Keycloak = IdP side-effect với durable retry trên cùng request row.
2. Deletion ACK chỉ qua OIDC verified bearer (`selfActor`); deny-by-default.
3. Cross-tenant session revoke = SECURITY DEFINER `migration_owner` (+ owner policy nếu FORCE RLS) — pattern `event_attendees_owner`.
4. **Issuer allowlist:** chỉ `OIDC_ISSUER` / allowlist server config đã verify JWKS. Admin base URL + realm path **cố định config** — không lấy issuer/URL từ JWT `iss` chưa allowlist, không từ body client.
5. **IdP identity key:** `(allowlisted_issuer, oidc_sub)` → resolve Keycloak user **by UUID** với contract `sub` = Keycloak user id. **Cấm** search-delete by email hoặc username fuzzy; **cấm** fallback mơ hồ.
6. Audit retain 730d; sanitized IdP errors (no token/secret/PII). Denylist TTL **riêng** (§5.4) — không silent extension O06.
7. Multi-instance workers: **lease** trên request row trước IdP call (tránh concurrent DELETE).

## 4. SEC-1 — Stale `staff_sessions` (**confirmed**)

### 4.1 Choice

**A + R1+R2:** helper `revoke_sessions_for_user(p_user_id)` SECURITY DEFINER; gọi tại ACK và lại trong apply (idempotent). Soft-check trong `assertSessionActive` only = **không đủ**.

### 4.2 Status

- Design đủ triển khai; **BE #345 / PR #348 đang chạy** — không block IdP design.
- Consumers: Gate paths; store honesty về privileged access sau delete.

### 4.3 Impl paths (BE-S1)

Migration + `account-deletion.ts` ACK hook; tests `platform.test.cjs` / `gate.test.cjs` (session → ACK → `SESSION_NOT_ACTIVE`). Optional: deny `openStaffSession` khi open `REQUESTED`.

### 4.4 Gap ACK vs apply (explicit)

PR [#348](https://github.com/hangndat/ticket-solution/pull/348) (SEC-1) theo mô tả hiện tại là **apply-only** revoke trong `apply_account_anonymization`. **ACK-time revoke** vẫn là phần D1 đã chốt nhưng **có thể còn thiếu** trên tip #348 — tracker riêng cho BE #345 / follow-up; **không** coi apply-only là đủ D1. Architect **không** merge/tự sửa runtime ở đây.

### 4.5 R5 — `REJECTED` sau revoke

Nếu sessions đã REVOKED tại ACK (hoặc apply) rồi request chuyển **`REJECTED`**:

- Sessions **giữ REVOKED** — **không** restore ACTIVE.
- User **được** authenticate lại tường minh để mở **session mới** chỉ khi: **không** còn open deletion request **và** user **chưa** bị anonymize (`pg_applied_at` null / subject chưa `anon:`).
- Fail-closed: không “undo revoke” khi REJECTED.

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

Internal columns trên `account_deletion_requests` (đề xuất tối thiểu — **R2**):

| Column | Ý |
| --- | --- |
| `pg_applied_at timestamptz` | PG scrub+rotate+session revoke xong |
| `original_issuer text` NULL | Snapshot tạm cho job IdP — **scrub khi** terminal IdP success / at COMPLETED |
| `original_subject text` NULL | Snapshot tạm — **scrub** như trên |
| `subject_tombstone_digest bytea` | HMAC digest (§5.4 R4) — **không** plaintext sub |
| `subject_tombstone_key_id text` | Key id trong keyring đã dùng khi HMAC |
| `subject_tombstone_expires_at timestamptz` | Absolute expiry digest (**R1**); index cho purge |
| `idp_lease_owner text` / `idp_lease_expires_at` | Multi-instance lease trước Admin call |
| `idp_status text` | `PENDING` \| `DISABLED_PENDING_DELETE` \| `DELETED` \| `NOT_FOUND` \| `FAILED` |
| `idp_attempts int` / `idp_next_attempt_at` | Bounded backoff |
| `idp_last_error_code text` | Sanitized enum/code only |
| `idp_deleted_at timestamptz` NULL | Wall-clock khi IdP terminal `DELETED`/`NOT_FOUND` (neo R1) |

**Indexes (bắt buộc):** `(subject_tombstone_digest)` WHERE digest NOT NULL; `(subject_tombstone_expires_at)` WHERE digest NOT NULL — phục vụ deny-lookup + hourly purge.

**Terminal success:** `state=COMPLETED` **iff** `pg_applied_at IS NOT NULL` **AND** `idp_status IN ('DELETED','NOT_FOUND')`.

- `DISABLED_PENDING_DELETE` / `FAILED` / `PENDING` → **stay `REQUESTED`** (open unique vẫn giữ một open row).
- **Không** map disable → `SUCCEEDED` / `COMPLETED`.

### 5.4 Tombstone / denylist — R1–R5 (**chốt**, reject indefinite)

**Mục đích bảo mật (bounded):** chặn (1) access JWT còn hạn sau IdP DELETE và (2) recreate app user cùng `(issuer, sub)` trong cửa sổ ngắn. Digest **không** phải audit trail — **cấm** silent kế thừa O06 audit **730d**.

#### Evidence neo TTL (không invent)

| Nguồn | Fact |
| --- | --- |
| `packages/backend/src/oidc.ts` / `platform-oidc.ts` | `jose.jwtVerify({ issuer, audience, algorithms })` — kiểm `exp` mặc định; **không** set `maxTokenAge` / không trần lifetime |
| `jose` `JWTClaimVerificationOptions.maxTokenAge` | Có thể bắt buộc `iat` + trần tuổi token — **BE-S2 phải bật** (xem R1) |
| `infra/keycloak/realm-ticket.json` | **Không** pin `accessTokenLifespan` / SSO timeouts → **không** suy max từ export |
| Keycloak `Constants` ([constant-values](https://www.keycloak.org/docs-api/latest/javadocs/constant-values.html)) | Default `DEFAULT_ACCESS_TOKEN_LIFESPAN` = **300s**; `DEFAULT_SESSION_MAX_LIFESPAN` = **36000s** (10h); offline defaults dài hơn nhưng **clients realm export không gắn offline scope** |
| Sau `DELETE` user | User entity + sessions bị xóa; **refresh / offline token không mint** access mới cho UUID đã xóa (user absent). Denylist chỉ cần phủ access JWT đã phát hành trước delete |
| UUID reuse | Keycloak user id = UUID tại create; DELETE gỡ entity — **pin contract** `sub` = user UUID; **không** giả định reuse; recreate = UUID **mới** → digest cũ không chặn identity mới (đúng ý) |

#### R1 — Digest TTL (**chốt**)

| Tham số | Giá trị |
| --- | --- |
| TTL denylist | **`subject_tombstone_expires_at = idp_deleted_at + 48h`** (sau IdP confirmed `DELETED`/`NOT_FOUND`) |
| Accepted max access-token lifetime | **`≤ 24h`** từ `iat` → `exp` (và tuổi từ `iat`) |
| Clock skew | **`+ 5 phút`** (`clockTolerance` jose hoặc tương đương) |
| Purge | Worker job **hourly**: `DELETE/NULL digest` khi `subject_tombstone_expires_at < now()`; owner = **worker** (cùng process due-list) |
| Verifier bound | **Bắt buộc BE-S2:** mọi path `verifyBearerToken` (attendee + platform) reject token nếu thiếu `iat` hoặc `now - iat > 24h + 5m` **hoặc** `exp - iat > 24h` — dùng `jose` `maxTokenAge: 24h` + `clockTolerance: 300` **và/hoặc** check tường minh. **Compatibility evidence:** ops/config proof realm `accessTokenLifespan` (và client override) **≤ 24h**; nếu live realm > bound → **ops blocker** trước bật erasure (không “assume default 300s”) |

**48h** = shortest bounded window ≥ (accepted max access lifetime 24h + skew) với margin vận hành purge hourly — **không** phải O06 audit extension.

**Reject:** indefinite “until ADR”; pepper-drop trước khi mọi digest old-key hết hạn; re-HMAC không có plaintext.

#### R2 — Storage shape (**chốt**)

- Cột trên **`account_deletion_requests`**: `subject_tombstone_digest`, `subject_tombstone_key_id`, `subject_tombstone_expires_at` (+ indexes §5.3).
- **Không** bắt buộc bảng `identity_denylist` riêng ở MVP (có thể tách sau nếu volume/ops đòi hỏi) — lookup deny = query digest chưa hết hạn.
- Purge owner: **worker** hourly.
- `original_issuer` / `original_subject`: **scrub NULL** khi `idp_status IN ('DELETED','NOT_FOUND')` trước/at `COMPLETED` (không chờ hết TTL digest).

#### R3 — HMAC keyring (**chốt**)

| Item | Spec |
| --- | --- |
| Config | Shared named keyring readable bởi **API + worker** (cả hai verify/deny). Env placeholder trong `.env.example` only — never commit secrets |
| Entry | `{ keyId: string, secret: ≥32 cryptographically random bytes }` |
| Active | Một `currentKeyId` để **mint** digest mới lúc snapshot |
| Verify | Chấp nhận **mọi key còn trong keyring** cho đến khi **mọi** digest gắn `key_id` đó đã `expires_at < now()` (hoặc đã purge) |
| Rotation | Thêm key mới → mint bằng key mới; giữ key cũ trong dual-accept window = max remaining digest TTL cho key đó; **cấm** drop key còn digest sống; **cấm** re-HMAC khi không còn plaintext `original_*` |
| Fail-closed | Missing/empty required keyring hoặc thiếu key cho `currentKeyId` → **fail closed** + **alert** (không mint digest / không skip denylist) |

#### R4 — Canonical HMAC (**chốt**)

```text
digest = HMAC-SHA256(
  key.secret,
  UTF8( JSON.stringify( [ exactAllowlistedIssuer, exactSub ] ) )
)
```

- `exactAllowlistedIssuer` = chuỗi issuer **đã verify** khớp canonical config (`OIDC_ISSUER` / allowlist entry) — **không** normalize thêm (không strip/add trailing `/` ngoài giá trị config đã chốt).
- `exactSub` = `payload.sub` nguyên bản sau verify.
- Lưu `digest` (raw bytes hoặc hex cố định — chọn **một** encoding trong impl + tests) + `key_id`.

#### R5 — REJECTED vs sessions

Xem §4.5 — sessions **ở lại REVOKED**; không restore.

#### Observability (SEC-D2)

- Metric/alert **sanitized** (không PII): số request `state=REQUESTED` với `created_at` (hoặc policy due) **quá SLA O06 ≤30d** IdP erase — ví dụ `account_deletion_idp_sla_overdue` gauge/count + alert.
- `idp_last_error_code` enum only (đã có).

### 5.5 Ordering / failure matrix (I2)

```text
ACK REQUESTED → revoke sessions (SEC-1; ACK hook — xem gap §4.4)
Worker (lease IdP row):
  if pg_applied_at is null:
    snapshot issuer/sub (allowlisted issuer only)
    mint tombstone digest (R3/R4); set expires_at tentative = now()+48h
       (final: idp_deleted_at+48h khi terminal IdP)
    PG scrub + rotate + revoke sessions
    set pg_applied_at
    optional: Keycloak logout + disable → idp_status=DISABLED_PENDING_DELETE
       (KHÔNG COMPLETED)
  claim lease → DELETE user by Keycloak UUID (= sub)
  DELETE 204/404-confirmed-absence → idp_status=DELETED|NOT_FOUND
       set idp_deleted_at; subject_tombstone_expires_at = idp_deleted_at + 48h
       scrub original_* ; state=COMPLETED ; release lease
  retryable errors → FAILED + backoff ; stay REQUESTED
Hourly: purge digests with expires_at < now()
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

**Contract pin (ops + BE):** JWT `sub` **=** Keycloak user UUID. Recreate sau delete → UUID mới (không reuse id đã xóa trong JPA provider bình thường). **Cấm** fuzzy email/username delete.

1. Verify JWT với JWKS của **allowlisted issuer** + **R1 maxTokenAge/lifetime bound**.
2. Worker đọc snapshot `(original_issuer, original_subject)` chỉ nếu `original_issuer` ∈ allowlist config.
3. Admin API base = `KEYCLOAK_BASE_URL` + fixed realm (e.g. `ticket`) from config — **không** parse host từ issuer string tùy ý nếu khác allowlist mapping table.
4. Resolve **ưu tiên duy nhất production path:** `GET /admin/realms/{realm}/users/{id}` với `id = original_subject` (UUID).
5. **Ops fallback chỉ khi** contract `sub≠UUID` chưa pin được — **blocker ops**, không đoán. Nếu (và chỉ nếu) realm đã chứng minh `username ≡ sub` bằng evidence config: Admin list users với query params chính thức **`username=<sub>&exact=true`** ([Keycloak Admin REST — Get users](https://www.keycloak.org/docs-api/latest/rest-api/index.html); `exact` áp dụng cho `username`). **Cấm** `q=username:` mơ hồ / search prefix.
6. `DELETE /admin/realms/{realm}/users/{id}`.
7. Sau DELETE: refresh token cũ **không** mint access mới (user absent); access JWT còn hạn bị chặn bởi denylist + open REQUESTED cho đến TTL.

### 5.7 Least privilege + multi-instance

| Item | Spec |
| --- | --- |
| Client | `vemoki-erasure` confidential; roles tối thiểu delete/manage-users (+ view để GET-by-id). Không `realm-admin` |
| Secret | **Worker-only** env cho Admin client; never API process; never commit. **HMAC keyring** riêng — shared API+worker (R3), khác erasure secret |
| Lease | `UPDATE … SET idp_lease_owner, idp_lease_expires_at WHERE lease expired OR owner=self` trước Admin call; short TTL (e.g. 30–60s) reclaim |
| Errors | Store codes like `IDP_TIMEOUT`, `IDP_HTTP_503`, `IDP_PATH_404`, `IDP_USER_404`, `IDP_FORBIDDEN` — no body dump |

### 5.8 Consumers

| Consumer | Blocked until |
| --- | --- |
| Store deletion release gate | SEC-1 merged (ACK+apply) + SEC-2 I2 COMPLETED semantics live |
| BE-S2 IdP delete Task | This handoff tip (R1–R5 chốt) |
| Ops Keycloak erasure client + realm lifespan ≤24h evidence | Before prod enable |
| SEC-1 / BE #345 | **Not** blocked on SEC-2; ACK gap §4.4 riêng |

## 6. End-to-end sequence (MVP chốt)

```text
POST /v1/me/account-deletion-requests
  → REQUESTED + O06 policy
  → revoke_sessions_for_user (ACK — required by D1; may still be missing on PR348 apply-only)
  → deny openStaffSession if open deletion (recommended)

Worker due list: state=REQUESTED AND policy set AND due
  → lease + mint digest + PG apply flags (no public enum change)
  → optional disable/logout (non-terminal)
  → DELETE IdP user (terminal IdP success)
  → scrub original_*; set expires_at = idp_deleted_at+48h; COMPLETED

upsertFromVerifiedIdentity / API after JWT verify (+ maxTokenAge)
  → reject if open REQUESTED for user OR unexpired tombstone digest hit

REJECTED
  → sessions stay REVOKED; new login only if no open deletion and not anonymized

Hourly worker
  → purge expired digests; emit sanitized SLA-overdue metric
```

## 7. Regression test matrix (BE-S2 + SEC-1 overlap)

| # | Case | Expect |
| --- | --- | --- |
| T1–T3 | Session revoke ACK/apply; audit retained; idempotent apply | SEC-1 (BE #345); ACK path required |
| T4 | IdP DELETE success → `DELETED` + `COMPLETED` | |
| T5 | Confirmed user 404 → `NOT_FOUND` + `COMPLETED` | |
| T6 | Admin/realm path 404 → `FAILED`, **not** COMPLETED | |
| T7 | Disable-only → `DISABLED_PENDING_DELETE`, state stays `REQUESTED` | |
| T8 | 503 then DELETE | stays open until DELETE/NOT_FOUND |
| T9 | Re-login / upsert same sub while REQUESTED or within digest TTL | reject |
| T10 | Expired JWT still signed | reject via tombstone/open deletion after verify |
| T11 | Two workers | only one holds lease; no double DELETE panic (second 404 OK) |
| T12 | Fuzzy email / `q=` search delete attempted | **not implemented** / helper rejects |
| T13 | Issuer not on allowlist | no Admin call |
| T14 | `original_*` scrubbed after COMPLETED; digest may remain until TTL | plaintext absent |
| T15 | Fake IdP adapter in tests | no real Keycloak required |
| T16 | Token `exp-iat` > 24h or age > 24h+5m | verifier reject (R1) |
| T17 | Digest past `expires_at` | upsert allowed (new UUID identity only if IdP recreated) |
| T18 | Key rotation: old key accepted until digests expire; drop early → fail | |
| T19 | REJECTED after ACK revoke | sessions remain REVOKED |
| T20 | SLA overdue metric | sanitized; no PII labels |

## 8. Quyết định — trạng thái

| # | Was open | Now |
| --- | --- | --- |
| SEC-1 A+R1+R2 | Đề xuất | **Confirmed** (BE #345); ACK gap nếu PR348 apply-only |
| No new public enum; flags + COMPLETED=both | Đề xuất | **Confirmed** |
| I1 vs I2 | Đề xuất I1 | **Rejected I1-as-done; chốt I2 DELETE** |
| Tombstone retention / pepper | Indefinite / under-specified @ `ab3f3c48…` | **R1–R4 chốt** — 48h TTL; columns+index; keyring dual-accept; canonical JSON HMAC |
| REJECTED sessions | Unspecified | **R5 — stay REVOKED** |
| openStaffSession deny | Đề xuất | **Recommended** with SEC-1 |

## 9. Handoff ownership

| Task | Ownership | Deps |
| --- | --- | --- |
| **BE-S1** session revoke ACK+apply | `backend` #345 / PR #348 | ACK hook nếu còn thiếu |
| **BE-S2** IdP DELETE + flags + upsert/JWT deny + lease + R1–R4 + SLA metric | `backend` · `packages/backend` · `apps/worker` | This doc tip |
| **Ops** Keycloak client + `sub`=UUID contract + realm lifespan ≤24h evidence | coordinator/ops | Before prod erasure |
| **BA/ASC** (optional) | `product-ba` | After BE-S2 — copy must not claim disable-only |
| DoD/security | independent sessions | Revalidate **new tip SHA** (không kế thừa FAIL @ `ab3f3c48…`) |

### Paths (impl SEC-2)

- `packages/backend/prisma/migrations/*` (columns + indexes + lease; no public enum widen unless required for CHECK on `idp_status` only)
- `packages/backend/src/account-deletion.ts`
- `packages/backend/src/users.ts` (+ API identity gate)
- `packages/backend/src/oidc.ts` / `platform-oidc.ts` (`maxTokenAge` / lifetime bound)
- `packages/backend/src/keycloak-erasure.ts` (new)
- `apps/worker/src/index.ts` (lease, delete, hourly purge, SLA metric)
- tests + `.env.example` placeholders (erasure client + HMAC keyring)

## 10. Kết luận

| Hạng mục | Status |
| --- | --- |
| SEC-1 | **Confirmed / implementing** (#345); ghi nhận ACK gap nếu tip #348 apply-only |
| SEC-2 | **Đủ để triển khai** — I2 DELETE ≤30d; COMPLETED iff PG+IdP; disable non-terminal; allowlist issuer; **bounded denylist R1–R4**; R5 REJECTED; SLA metric |
| Compliance evidence | Neo Apple primary “disable insufficient”; **không** dùng “≈ không dùng lại” |
| Privacy | **Reject** indefinite digest + unsafe pepper-drop; TTL 48h **không** = O06 730d |
| Verdict | **Đủ để triển khai trong scope** — spawn BE-S2 sau revalidation tip mới; DoD độc lập trên exact SHA mới |

**Blocked until SEC-2:** store full account-deletion release gate (IdP record still exists).  
**Unblocked:** BE-S2 coding từ tip handoff này (sau independent revalidation); SEC-1 parallel.
