# DoD review — PR #101 (MinIO durable + APNs fail-closed)

| Field | Value |
| --- | --- |
| Reviewer | Cursor DoD (Orca worker `term_2ec257dc-dea1-4932-b586-75ba572ec886`, task `task_e3bbbb3d9122`, dispatch `ctx_83ba5aabeab9`) — ≠ implementer (PR author / tip commit `hangndat`) |
| Scope | PR #101 `hangndat/d5-be-minio-apns`; Issue #6 residual. Paths: `infra/deploy/**`, `apps/worker/src/index.ts`, `packages/backend/src/{apns,minio,outbox,email-adapter,notification-status,index}.ts`, `packages/backend/test/{apns-unit,csv-guard}.test.cjs`, `.env.example` |
| Commit SHA | `f7a718fa281ddcbbf4d408deece25babdd4e8eef` (confirmed `git rev-parse` + `gh pr view 101` + CI `headSha`) |
| Checks | Local (worktree tip): `pnpm --filter @ticket/backend test` → **22 pass** (APNs fail-closed + `ACCEPTED`≠`DELIVERED`); `pnpm exec tsc -p tsconfig.json --noEmit` in `apps/worker` → ok. CI run `39013618489` on tip: `backend` / `database-isolation*` / `d5-*` / `ci` / `turbo-persist` **success** |
| Verdict | **PASS with known gap** |

## Checklist (task scope)

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Exact tip SHA under review | **PASS** | Single commit on PR: `f7a718fa281ddcbbf4d408deece25babdd4e8eef` |
| 2 | MinIO compose + `.env.example` durable | **PASS** | `infra/deploy/compose.yaml`: `minio` + volume `minio_data`, `minio-init` private buckets, api/worker `MINIO_*` + `depends_on minio-init`. `infra/deploy/.env.example` placeholders only (`change_me_*`); internal-only (no edge publish 9000/9001) |
| 3 | APNs fail-closed without key | **PASS** | `isApnsEnabled` default false; `APNS_ENABLED=true` + missing key → `requireApnsConfig` / `createApnsAdapter` throw `APNS_MISCONFIGURED` at construct. Worker omits adapter when disabled; constructs (fail-closed) only when enabled |
| 4 | No fake `DELIVERED` | **PASS** | `providerStatusFromDbState`: `SENT`/`ACCEPTED` → `ACCEPTED` only; `DELIVERED` falls to `PENDING`. APNs 200 → `ACCEPTED`. Tests assert never `DELIVERED` |
| 5 | Tests | **PASS** | `apns-unit`: disabled default, enabled-without-key fail-closed, `APNS_KEY_PATH` read, providerStatus honesty. Full backend unit suite 22/22 on tip |
| 6 | Deploy notes for VPS | **PASS** | `infra/deploy/README.md` § MinIO (up minio/minio-init → restart api/worker → CSV READY) + § APNs (host `.p8` mount, uncomment volume, recreate worker; ACCEPTED≠DELIVERED) |
| 7 | No secrets / credentials in diff | **PASS** | Diff secret-pattern scan clean (no `.p8` body, no `BEGIN PRIVATE KEY`, no live keys). Deploy `.env.example` = placeholders; APNs mount path documented only |

## Known gaps (non-blocking for this BE/ops residual)

1. **VPS deploy not executed in this PR/review:** operator still must set `/opt/vemoki/.env` MinIO creds, `up -d minio minio-init`, restart api/worker; optional AuthKey mount for push. Parent Issue #6 device UAT remains separate.
2. **MinIO healthcheck** uses `curl` inside `minio/minio` image — first VPS boot should confirm health → `minio-init` completes; if image lacks curl, swap healthcheck (ops follow-up, not a code honesty defect).
3. **Root `.env.example` `minioadmin`:** pre-existing local-doc placeholders (unchanged by this PR except APNs comment); deploy catalog correctly uses `change_me_*`.

## Findings

No blocking security or correctness findings on tip SHA. MembershipInvite outbox no longer stalls solely on missing `TICKET_CREDENTIAL_KEY` (TicketIssued still fail/retry without key). Invite accept link uses `PUBLIC_WEB_BASE_URL` (production fail-closed if missing/non-https). Push path remains skip-when-disabled / fail-closed-when-enabled-misconfigured; SMTP/APNs acceptance never claimed as end-user delivered.

## Verdict

**PASS with known gap** on exact SHA `f7a718fa281ddcbbf4d408deece25babdd4e8eef`. Safe to merge for MinIO durable + APNs fail-closed residual; revalidate after VPS MinIO bring-up (+ optional APNs enable), and if tip SHA gains further behavior.
