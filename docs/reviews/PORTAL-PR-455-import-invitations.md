# DoD (+ security) — PR #455 import job lifecycle + guest invitations

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Orca Cursor `reviewer-dod` (+ checklist `reviewer-security`) · terminal `term_8aab0bf0-5219-4f5c-9a35-57173053fcc8` · task `task_9c5b502f6848` · dispatch `ctx_e6b93cb3cefc` · Run `run_34fde1e32ed1` · **≠** implementer `ctx_d05d6ead70eb` |
| Scope | PR [#455](https://github.com/hangndat/ticket-solution/pull/455) · Issue [#423](https://github.com/hangndat/ticket-solution/issues/423) · Story [#421](https://github.com/hangndat/ticket-solution/issues/421) · Epic [#406](https://github.com/hangndat/ticket-solution/issues/406) · paths `apps/api`, `apps/worker`, `packages/backend` (+ tests) |
| Commit SHA | `1967ee548e0f559bf4a8e895c43831ffd3641f29` (confirmed `git rev-parse HEAD` = tip PR) |
| Architecture | **Có** — ADR-20 portal admin · handoff [`docs/architecture/PORTAL-CONTRACT-HANDOFF.md`](../architecture/PORTAL-CONTRACT-HANDOFF.md) D1–D4 (multipart MinIO quarantine, preview không reserve, invitations masked, claim email-bound) |
| Decision IDs | ADR-20 · O06 (retention TTL note) · contract #447 / handoff import+invite |
| Checks | Xem bảng dưới |
| Verdict DoD | **PASS with known gap** |
| Verdict security | **PASS with known gap** |

## Checks (exact SHA)

| Check | Kết quả |
| --- | --- |
| CI run [39139170479](https://github.com/hangndat/ticket-solution/actions/runs/39139170479) trên tip | **changes / backend / web / portal / mobile / database-isolation (10 shards) / ci / turbo-persist** = SUCCESS; d5-* SKIPPED |
| Local: `pnpm --filter @ticket/backend build` rồi `node --test --test-force-exit test/import-invitations.test.cjs` | **PASS** (~5.1s) — I1–I9 / V1–V4: preview+dispatch không `allocated++`; list fail-closed privacy; claim email mismatch; commit replay; claim tăng allocated đúng 1 |
| Graph review | `detect_changes` vs `cd7f2261…` → 15 files / risk ~0.6; đọc source `import-jobs.ts`, `guest-invitations.ts`, migration `202610180007_e406_import_invitations`, `inventory.ts`, `outbox.ts`, worker cleanup |

## Acceptance mapping

| AC | Verdict | Evidence |
| --- | --- | --- |
| H-I1 multi-step CSV (upload → create → preview → commit → errors) + MinIO quarantine key server-minted | **PASS** | `uploadImportFile` / `createImportJob` / `previewImportJob` / `commitImportJob` / `downloadImportErrors`; key `tenants/{t}/events/{e}/imports/quarantine/{fileId}`; DTO `toJobDto` **không** trả `object_key` |
| H-I2 list / dispatch-preview / dispatch / claim | **PASS** (API lifecycle) | Endpoints OpenAPI + `inventory.ts`; list `invitedEmailMasked` + fail-closed keys; claim hash token + email verified |
| Preview / dispatch **không** reserve quota | **PASS** | Comment + code; isolation test asserts `allocated` unchanged through preview/commit/dispatch; claim → `allocated + 1` |
| No raw invitation token in API responses | **PASS** | List privacy check; commit response không token; test `!JSON.stringify(listed).includes(mintedAda.token)` |
| Worker TTL cleanup import files | **PASS with gap** | Worker gọi `cleanupExpiredImportFiles`; **chỉ** xóa row PG (`void store`) — object MinIO có thể còn đến O06 sweeper |
| CI xanh exact SHA | **PASS** | Run 39139170479 xanh; **gap**: shard `import-invitations` **chưa** nằm trong matrix `database-isolation` (có trong `test:db` local) — reviewer chạy local thay |

## Security notes (import CSV / invitation tokens / MinIO)

Abuse cases xét trong scope:

1. **Quota bypass / premature reserve** — preview & dispatch chỉ đọc `capacity - allocated`; không `UPDATE quota_buckets`. Commit CODES/GUESTS không `allocated++`. **OK.**
2. **Token leakage qua API** — DB lưu `token_hash` (unique); raw token chỉ trong outbox payload; API list/job/commit không trả token. **OK cho API surface.**
3. **Email / PII projection** — list fail-closed nếu DTO có `invitedEmail` / `token` / `rawToken`; errors CSV chặn URL/`object_key`/`presign`. **OK.**
4. **Tenant isolation** — migration ENABLE+FORCE RLS + policy `app.tenant_id` trên `import_files` / `import_jobs` / `guest_invitations` / `invitation_dispatch_previews`. Cross-tenant importId → 404 (test). **OK.**
5. **Authz** — `inventory.import` + event assignment qua `requireTenantPermission` trên mọi admin path; claim yêu cầu email verified. **OK.**
6. **Idempotency / replay** — commit & dispatch qua `operations` + `Idempotency-Key` UUID; stale previewRevision → `IMPORT_STALE_PREVIEW`. **OK.**
7. **CSV / MinIO** — multipart Nest bounded; UTF-8 assert; client không gửi object key; bucket private. **OK** (khớp handoff D2 option A).
8. **Outbox raw token** — `InvitationTokenMinted` / `InvitationReady` chứa raw token trong PG outbox (cần cho mail). Operator có quyền DB vẫn đọc được. **Hardening residual** (không phải API leak).

## Findings

### Should-fix (không chặn merge theo AC Issue #423 / H-I2 GAPS đã ghi)

1. **Outbox mail guest chưa được worker xử lý** — `processClaimedOutbox` chỉ hiểu `MembershipInvite` + `TicketIssued`; mọi type khác (gồm `InvitationReady`, `InvitationTokenMinted`) → `markOutboxDeadFenced('unsupported type')`. Contract handoff D3 ghi «Dispatch: Gửi mail / DISPATCHED»; API đã set `DISPATCHED` + insert outbox, nhưng **email guest chưa gửi được** cho đến khi có handler. H-I2 AC trong `PORTAL-BACKEND-GAPS` (masked list, previewRevision, conflict, no raw token) **vẫn đạt**; đây là gap end-to-end mail / architecture drift nhẹ so với D3 «Gửi mail».
2. **CI matrix thiếu** `test/import-invitations.test.cjs` — acceptance isolation chưa gated bởi GitHub Actions dù `test:db` local có file. Nên thêm shard trước khi coi coverage CI đủ.
3. **`cleanupExpiredImportFiles`** không `deleteObject` MinIO — chỉ DELETE metadata; object quarantine có thể orphan đến O06.

### Nit

- Claim lookup `WHERE token_hash = …` (global unique) rồi so `event_id` — ổn nhờ UNIQUE; có thể thêm `tenant_id` explicit cho defense-in-depth khi RLS context lệch.

### Blocker

Không.

## Architecture đối chiếu (ADR-20 / handoff)

| Handoff | Impl |
| --- | --- |
| D1 multi-step + legacy `{codes}` | Có job path + `importRedemptionCodes` legacy giữ |
| D2 multipart + server-minted fileId | `POST …/imports/files` |
| D3 preview không allocate; commit idempotent | Khớp; mail outbox **chưa** complete path |
| D4 masked list; dispatch-preview; claim email mismatch | Khớp |

Không cần Architect gate riêng để merge; gap mail nên theo dõi Issue/follow-up BE (handler `InvitationReady`).

## Limitations

- Reviewer không merge / không deploy / không DNS.
- Không UAT portal UI (ngoài scope; không đụng `apps/portal` trừ đọc).
- Artifact docs này có thể được commit **sau** SHA đang duyệt (docs-only); verdict gắn **code SHA** `1967ee548e0f559bf4a8e895c43831ffd3641f29`.

## Merge note

Coordinator **có thể merge** sau khi chấp nhận known gaps (mail outbox + CI shard + MinIO delete). Reviewer **không** merge.
