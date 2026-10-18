# DoD review — PR #297 / Issue #295 (D12 O06 account anonymize)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor Role `reviewer-dod` · terminal `term_93974e2e-a51a-4e0d-bd9f-debba780ea03` · task `task_229ff6d37598` · dispatch `ctx_f92f36448637` (**≠** implementer session) |
| Scope | Issue #295 · PR #297 · `packages/backend`, `apps/worker`, migrations, `docs/reviews/D12-BE-RELEASE-VERIFY.md` |
| Commit SHA reviewed | `f9232aab16c9207c5ece202969582b4ba35bdd22` (PR tip; confirmed `git rev-parse` / `gh pr view 297`) |
| Impl SHA (behavior) | `0f6deb78863cb6ca8c7ac5b04383ccea2f6e56fd` |
| Architecture impact | **Có** — đối chiếu DECISION-LOG O06 + `docs/ops/PLATFORM-POLICY.md` §5 + `docs/ops/O06-OPTIONS.md` |
| Checks | Detached at review SHA: `pnpm --filter @ticket/contracts build` · `pnpm --filter @ticket/backend build` · `node --test test/platform.test.cjs` → **PASS** · `node --test test/rls-catalog.test.cjs` → **PASS**. GitHub check-runs on SHA: **chưa có** (pending). Diff secret scan: không thấy credential thật. |
| Verdict | **PASS with known gap** |

## Checklist

| # | Gate | Result |
| - | ---- | ------ |
| 1 | Anonymize ≤30d đúng O06; audit không xóa cứng trong TTL 730d | **PASS** — ACK `REQUESTED` + `policy_version=O06-2026-10-18`; worker `processDueAccountAnonymizations` gọi SECURITY DEFINER ngay khi due (`requested_at ≤ now`) → thỏa SLA ≤30d; `apply_account_anonymization` scrub email/subject/tokens/`canonical_email`, set `COMPLETED`; comment SQL + test assert **không** DELETE `audit_logs` / `platform_audit_logs`; constants `O06_ACCOUNT_ANONYMIZE_MAX_DAYS=30`, `O06_AUDIT_TTL_DAYS=730` khớp DECISION-LOG |
| 2 | RLS / SECURITY DEFINER an toàn; không bypass tenant runtime | **PASS** — `SET search_path = pg_catalog, public`; `REVOKE PUBLIC` + `GRANT EXECUTE` chỉ `ticket_runtime` (pattern claim_outbox/exports); owner `migration_owner`; `event_attendees_owner` USING(true) thêm vào allowlist `DEFINER_OWNER_TABLES` (cùng pattern `users_owner_definer` / `device_tokens_owner`); API chỉ expose ACK `createAccountDeletionRequest` qua actor RLS — không route HTTP gọi apply trực tiếp |
| 3 | Evidence `D12-BE-RELEASE-VERIFY.md`: exact SHA, `productionClaim: false` | **PASS** (gap nhẹ) — `productionClaim: **false**` rõ; Impl SHA exact `0f6deb7…`; Tip field ghi “see PR #297 HEAD” thay vì literal `f9232aa…` (non-blocking) |
| 4 | Tests liên quan; không secrets | **PASS** — reviewer re-run platform + rls-catalog trên exact SHA; không secrets trong diff |
| 5 | Verdict | **PASS with known gap** |

## Architecture / policy đối chiếu

- DECISION-LOG O06 #1–#3: account anonymize ≤30d; audit TTL 730d; không xóa cứng ngay — **khớp implementation**.
- PLATFORM-POLICY §5: ACK `REQUESTED`, `COMPLETED` sau job anonymize, không erase audit trong TTL — **khớp**.
- Stubs 365d ticket PII / 90d object → `NO_JOB_FRAMEWORK` (YAGNI) — đúng scope #295 (account path); không claim đã ship full retention matrix.

## Findings

### Blocker

_(none)_

### Should-fix (non-blocking)

1. `D12-BE-RELEASE-VERIFY.md` Tip SHA nên pin literal `f9232aab16c9207c5ece202969582b4ba35bdd22` thay vì “PR HEAD”.
2. Worker `catch {}` nuốt lỗi anonymize — REQUESTED còn lại nên recoverable, nhưng thiếu log/metric làm khó ops.
3. GitHub Actions check-runs chưa xuất hiện trên tip SHA — **coordinator chờ CI xanh** (đặc biệt `database-isolation`) trước merge.

### Nit

- `infra/.../security-config` / smoke vẫn in `o06=UNRESOLVED` trong khi DECISION-LOG đã chốt — evidence đã ghi; sync flag ngoài scope PR nếu không đụng file.

## Known gaps (chấp nhận được — không nuốt gate bắt buộc)

1. MFA `acr=2` live proof **FAIL local** — đã ghi trong release-verify; `productionClaim: false`.
2. Ticket PII 365d + object 90d chưa có job framework (YAGNI stubs).
3. `packages/contracts` vẫn literal `AWAITING_POLICY` / `UNRESOLVED` — ngoài ownership BE; consumer sync đợt sau.
4. CI GitHub trên SHA chưa report (local isolation revalidated).

## Merge note

Coordinator **có thể merge sau** CI xanh + board process. Reviewer **không** merge. Không đổi Status Project sang `Hoàn thành` từ session này.
