# D13 BE — Account deletion / O06 anonymize verify (S2-T2 · #320)

| Field | Value |
| --- | --- |
| Epic / Story / Task | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · Story [#305](https://github.com/hangndat/ticket-solution/issues/305) · Task [#320](https://github.com/hangndat/ticket-solution/issues/320) |
| Role | `backend` — `docs/agents/roles/backend.md` |
| Agent | `cursor` |
| Architecture impact | **Không** — verify/wire existing O06 execution; không đổi shared contract / IdP ADR |
| Branch | `hangndat/d13-be-account-deletion-verify` |
| Base `origin/main` (verify) | `ce6e8eeb0a4a419c618f3b3258fb56b5bba6c93b` |
| Source integration refs | `f551b6d2bdc06742f74a49a0970cb2bfae2f4e0e` · docs merge PR #308 `24ac8d9e1cca7985dea17d85862b1395cade3e4c` |
| Deploy tip marker (D12) | `0a65f3c2f2d51357ee1a6270151d279758188fb7` — **ancestor** of tip; chứaize migration + worker poll landed in #297 |
| Impl SHA (anonymize code) | `0a65f3c2f2d51357ee1a6270151d279758188fb7` (unchanged on tip; this PR = verification artifact only) |
| Tip SHA | **`de2952d33db1ffdd2c7268d5759f08eb51a6f145`** (artifact content) — nếu có commit docs-only sau đó, DoD lấy **PR HEAD** exact SHA |
| productionClaim | **false** — local isolated Docker Postgres tests only; **không** claim local tests = prod |

## 1. Verdict (implementer)

| Gate | Status |
| --- | --- |
| `POST /v1/me/account-deletion-requests` sau verified identity → `REQUESTED` + O06 policy | **PASS** (source + `platform.test.cjs`) |
| Worker/job gọi `processDueAccountAnonymizations` (không chỉ ACK) | **PASS** (`apps/worker` poll + `relayOnce`) |
| Anonymize ≤30d SLA / idempotent retry | **PASS** (due = `requested_at <= now`; second pass `applied=0`) |
| PII scrub + device revoke; audit **không** DELETE (TTL 730d) | **PASS** |
| Phân biệt account deletion vs `NO_JOB_FRAMEWORK` stubs | **PASS** — stubs chỉ ticket-PII 365d / object 90d |
| RLS / NOBYPASSRLS catalog | **PASS** (`rls-catalog.test.cjs`) |
| Keycloak IdP user delete/disable trong apply | **GAP** (xem §5) — **không** coi hard App Review blocker nếu copy ≤30d + in-app initiate đúng; **không** claim IdP erasure |
| Production runtime | **Not claimed** |

**Kết luận:** Luồng đã hứa (request → schedule → worker anonymize) **đã đủ trên tip**; **không** cần sửa BE execution trong scope này. Artifact-only PR.

## 2. Source map (execution vs stub)

### 2.1 Account deletion — **wired**

| Bước | Location |
| ---- | -------- |
| HTTP POST/GET | `apps/api/src/platform.ts` — `selfActor` = attendee `identityVerifier` + `upsertFromVerifiedIdentity`; **không** mock auth |
| ACK / open request | `packages/backend/src/account-deletion.ts` → `createAccountDeletionRequest` / `getCurrentAccountDeletionRequest` (`withActor`, state `REQUESTED`, `policy_version=O06-2026-10-18`, `anonymizeWithinDays=30`) |
| SQL claim/apply | Migration `packages/backend/prisma/migrations/202610180001_d12_o06_account_anonymize/migration.sql` — `list_due_account_anonymizations` / `apply_account_anonymization` (SECURITY DEFINER → `ticket_runtime` EXECUTE; **không** DELETE `audit_logs` / `platform_audit_logs`) |
| Worker poll | `apps/worker/src/index.ts` — mỗi tick + `relayOnce` gọi `processDueAccountAnonymizations(db, 50)` |
| Constants | `packages/backend/src/retention-o06.ts` — `O06_ACCOUNT_ANONYMIZE_MAX_DAYS=30`, `O06_AUDIT_TTL_DAYS=730` |

`apply_account_anonymization` (tóm tắt): clear `users.email` / `email_verified`; rotate `users.subject` → `anon:<requestId>`; revoke `device_tokens`; null `event_attendees.canonical_email`; set request `COMPLETED`.

### 2.2 Retention helpers — **stubs (không phải account deletion)**

| Helper | Behavior |
| ------ | -------- |
| `processDueTicketPiiAnonymizations` | `{ skippedReason: 'NO_JOB_FRAMEWORK' }` — vé/check-in 365d |
| `processDueObjectRetentions` | `{ skippedReason: 'NO_JOB_FRAMEWORK' }` — object ≤90d |

**Không** false-claim toàn bộ O06 policy đã enforced — chỉ **account anonymize path** được chứng minh execution.

## 3. Checks chạy (local)

```bash
pnpm install --frozen-lockfile
pnpm --filter @ticket/contracts build
pnpm --filter @ticket/backend build
cd packages/backend
node --test test/platform.test.cjs test/rls-catalog.test.cjs
```

Kết quả (worktree này):

```text
✔ platform provision/invite/suspend/support/deletion acceptance
✔ every tenant table is FORCE RLS and ticket_runtime has no BYPASSRLS
ℹ tests 2
ℹ pass 2
ℹ fail 0
```

`platform.test.cjs` coverage liên quan O06:

- POST-equivalent `createAccountDeletionRequest` → `REQUESTED` / `RESOLVED` / `anonymizeWithinDays=30`
- Idempotent re-ACK cùng `requestId`
- `processDueAccountAnonymizations` → `scanned=1`, `applied=1`; email null; subject `anon:<id>`
- Audit count **không đổi** sau anonymize
- Second process → `applied=0` (idempotent)
- Subject rotate cho phép OIDC subject cũ upsert **user row mới**

## 4. So sánh deploy marker

| Ref | Ý nghĩa |
| --- | --- |
| `0a65f3c` | Merge PR #297 — O06 anonymize + release-verify; **có** migration + worker call |
| Tip `ce6e8ee` (+ artifact commit) | Vẫn chứa định `0a65f3c`; không regress path deletion trên `apps/worker` / `account-deletion.ts` / migration |

**Không** drill VPS / **không** assert prod DB đã migrate — chỉ source ancestry + local tests.

## 5. Gaps / handoff (không sửa trong PR này)

1. **Keycloak IdP:** `apply_account_anonymization` **không** disable/delete user IdP. Login lại với cùng OIDC subject tạo user app mới (subject cũ đã `anon:…`). Ghi limitation cho App Review honesty; xóa IdP = quyết định architect + ops (ngoài verify). **Không** escalate hard blocker scheduler — worker **đã** gọi anonymize.
2. **`staff_sessions`:** không `REVOKED` trong apply SQL — chỉ `device_tokens`. Gate session còn ACTIVE đến khi hết TTL/revoke khác.
3. **Ticket PII 365d / object 90d:** vẫn `NO_JOB_FRAMEWORK` (YAGNI) — tách khỏi account deletion.
4. **Contracts/UI:** `packages/contracts` literal lịch sử + iOS copy stale (“O06 chưa chốt”) — BA #308 / S5-T1 (PR #313) ngoài ownership BE.
5. **CRG:** graph MCP sẵn (`list_graph_stats`); semantic `anonymize` node name miss → xác minh bằng lean-ctx + `rg` trên source (limitation ghi nhận).

## 6. Non-goals

- Không đổi OpenAPI / root lock / CI
- Không mock auth production
- Không đọc/xuất real user/secrets; không mutate DB production / deploy
- Không merge `main` (coordinator + DoD độc lập)

## 7. Reviewer checklist (DoD / security)

- [ ] Exact SHA tip PR khớp artifact
- [ ] Worker vẫn gọi `processDueAccountAnonymizations` trên SHA đó
- [ ] Migration SECURITY DEFINER không bypassRLS cho `ticket_runtime` role flags
- [ ] Audit không bị DELETE trong apply
- [ ] Artifact **không** claim ticket/object jobs enforced
- [ ] Artifact **không** claim prod = local tests
