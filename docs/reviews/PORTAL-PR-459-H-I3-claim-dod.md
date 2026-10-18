# DoD review — Issue #424 / PR #459 (H-I3 invitation claim)

| Trường | Giá trị |
| --- | --- |
| Verdict | **PASS with known gap** |
| Reviewer / session | Role `reviewer-dod` · Agent Cursor · Orca terminal `term_476a28e3-eda0-4e0e-bafa-4604e705eeab` · Task `task_bb1fd2f7ef30` · Dispatch `ctx_0db142b07329` · Run `run_34fde1e32ed1` · **≠** implementer `ctx_de1eac3e9636` |
| Scope | Epic [#406](https://github.com/hangndat/ticket-solution/issues/406) · Story [#421](https://github.com/hangndat/ticket-solution/issues/421) · Issue [#424](https://github.com/hangndat/ticket-solution/issues/424) · PR [#459](https://github.com/hangndat/ticket-solution/pull/459) · ownership **backend** (`packages/backend` + claim wiring `apps/api`) · H-I3 |
| Commit SHA | `6519d7bf204df75d4aec390285f6dffa8fc22189` (exact PR `headRefOid` / tip) |
| Architecture impact | **Có** — invitation claim (ADR-20 · handoff D4 / H-I3): tenant-scoped token, one-time CLAIMED, email verified → issue path |
| Decision IDs | ADR-20 · handoff [`docs/architecture/PORTAL-CONTRACT-HANDOFF.md`](../architecture/PORTAL-CONTRACT-HANDOFF.md) D4 · GAPS H-I3 |

## Checks (exact SHA)

| Check | Kết quả |
| --- | --- |
| `git rev-parse` / PR head | `6519d7bf204df75d4aec390285f6dffa8fc22189` khớp |
| Diff scope | 2 files — `packages/backend/src/guest-invitations.ts`, `packages/backend/test/import-invitations.test.cjs` (không web/mobile/secrets) |
| Local isolation | `cd packages/backend && node --test --test-force-exit test/import-invitations.test.cjs` trên worktree SHA → **PASS** (~2.7s) — suite `H-I1/H-I2/H-I3 …` |
| CI Run | [39141167289](https://github.com/hangndat/ticket-solution/actions/runs/39141167289) trên headSha `6519d7bf…` — **ci / backend / database-isolation (10 shards) / turbo-persist / changes** = SUCCESS; web/portal/mobile/d5-* SKIPPED |
| Graph `detect_changes` / `get_review_context` | Graph build SHA lệch tip PR — **source + tests + CI thắng**; đọc full `claimGuestInvitation` + test diff tại exact SHA |

## AC mapping (H-I3)

Neo: Issue #424 · `PORTAL-BACKEND-GAPS.md` §5.2 H-I3 · handoff D4 · Spec task verify list.

| # | Kỳ vọng | Verdict | Evidence trên SHA |
| --- | --- | --- | --- |
| 1 | Tenant-scoped token lookup | **PASS** | `WHERE tenant_id = ${input.tenantId} AND token_hash = …` + `withTenant`; hardening nit từ DoD #455 |
| 2 | One-time CLAIMED | **PASS** | `CLAIMED` chỉ cho phép replay khi `operations` cùng `REDEEM_COMMAND` + `client_key` + `COMPLETED`; khác Idempotency-Key → `INVITATION_TOKEN_INVALID` 410; test assert |
| 3 | Email verified | **PASS** | Early gate `EMAIL_NOT_VERIFIED` 403; Nest `InventoryService.claim` truyền `user.emailVerified` từ OIDC; test `emailVerified: false` |
| 4 | No raw token leak | **PASS** | Claim response `!JSON.stringify(claimed).includes(token)`; list privacy (H-I2) giữ fail-closed keys |
| 5 | Quota +1 (issue path only) | **PASS** | Claim → `allocatedBefore + 1`; sau replay + rejected re-claim vẫn `+1`; dispatch/preview không đụng quota (H-I1/H-I2) |
| 6 | RLS | **PASS** | Migration `guest_invitations` ENABLE+FORCE RLS + policy `app.tenant_id`; claim SQL luôn bind `tenant_id` trong `withTenant` |

## Architecture đối chiếu

| Handoff / ADR | Impl trên SHA |
| --- | --- |
| D4 claim: attendee host; token one-time; email verified khớp bound email | Khớp — mismatch → `INVITATION_EMAIL_MISMATCH`; unverified → `EMAIL_NOT_VERIFIED` |
| Claim → issue = SoT quota | `redeemAndIssueTicket` + `REDEEM_COMMAND`; không reserve lúc dispatch |
| Tenant isolation | Explicit `tenant_id` trên token lookup (defense-in-depth ngoài UNIQUE `token_hash`) |

Không thấy design drift đáng kể cần Architect gate riêng trước merge.

## Findings

### Known gap (không nuốt H-I3 AC — same residual #455)

1. **CI matrix thiếu** `test/import-invitations.test.cjs` — acceptance isolation H-I3 **không** nằm trong GitHub Actions `database-isolation` shards dù local `test:db`/reviewer run PASS. Nên thêm shard trước khi coi coverage CI đủ cho import/claim.

### Should-fix / residual (không chặn H-I3)

2. **Outbox mail guest** (`InvitationReady` / `InvitationTokenMinted`) vẫn có thể dead-letter nếu worker chưa handler — gap end-to-end mail từ #455; ngoài AC claim API.
3. **MANUAL / `pending` approval**: claim có thể set `CLAIMED` khi `outcome.ok === 'pending'`; token one-time khóa trước khi ticket ACTIVE. Cùng Idempotency-Key vẫn replay qua `operations` COMPLETED; khác key → 410. Ghi nhận edge; không FAIL H-I3 AUTO path đã test.

### Blocker

Không.

## Limitations

- Reviewer không merge / không deploy.
- Không UAT portal UI / headless claim chrome (ngoài scope backend Task #424).
- Artifact docs có thể commit **sau** SHA đang duyệt (docs-only); verdict gắn **code SHA** `6519d7bf204df75d4aec390285f6dffa8fc22189`.

## Merge note

Coordinator có thể merge sau khi chấp nhận known gap CI-shard (hoặc thêm shard trong follow-up). `worker_done` ≠ Project **Hoàn thành**.
