# O06 F01 — Offline purge barrier (candidate)

Status: **local implementation candidate, not an accepted POL-03 implementation**. F01 stays open; the existing two automatic fix rounds remain 2/2. This is the bounded exception plan following the user's request to finish local work. The offline operator passed isolated tests on the pinned MinIO image, including version and multipart cleanup; an independent functional review and integrated paused-writer/deployment barrier proof are still required before acceptance.

## Invariant

For an event with non-null `ends_at`, after `ends_at + 90 days` no export CSV object, including older versions and orphaned uploads, may remain or reappear. `exports.purged_at` must be written only after this is demonstrated. `ends_at IS NULL` stays outside the sweep. `exports.expires_at` remains download TTL.

## Why the current online sweep cannot finalize

`processExportJob` prepares a stable key and performs PUT outside PostgreSQL before checking the lease again. A paused worker can PUT after the online sweep's DELETE. A presigned URL that expires while its PUT is in progress still completed and created an object on the pinned MinIO digest (`.artifacts/f01-presign-expiry-measurement.md`). Admin restart alone interrupted one paused PUT, but the same active writer key could PUT again afterward (`.artifacts/f01-restart-barrier-measurement.md`). An ordinary DELETE in a versioned bucket left an older data version (`.artifacts/f01-process-stop-barrier-measurement.md`).

## Proposed local maintenance protocol

This protocol trades a bounded service pause for a process-level barrier. It must run from a separate operations process, never from an export worker that it stops.

1. Reject new export requests when `now + configured download TTL + 24 hours >= ends_at + 90 days`. Check this under the event row lock at create, claim, and immediately before any PUT. This leaves one day after the latest permitted download expiry for the offline purge. On a past-cutoff event, fail the export job without writing an object. Do not change the O06 purge deadline; `ends_at IS NULL` remains outside the sweep.
2. Begin fencing at `ends_at + 89 days`, including PENDING and PROCESSING exports. Preserve all export rows and derive the stable object prefix from tenant and event IDs so orphaned keys are included. Block changes to `ends_at` after the fence. The operator must finish by `ends_at + 90 days`; an outage or incomplete inventory raises an overdue alert and cannot be marked complete.
3. Stop every process that can sign export PUTs, verify each has exited, and prevent the supervisor from restarting it. Disable its non-root MinIO writer identity. The worker must never receive root/admin credentials or another unrestricted PUT identity. Unknown process, identity, or restart status stops the protocol.
4. Stop **all** MinIO server processes and positively verify exit; then start the same volumes and wait for read/write quorum health. This cuts server-side in-flight work. A client timeout, an HTTP error, or `mc admin service restart` response alone is not this barrier. If the topology cannot enumerate every MinIO process, stop without finalizing.
5. With a separate admin identity, list every current object, data version, delete marker, and incomplete multipart upload under each due export prefix. Remove them with explicit version IDs as needed; repeat inventory and require empty results. Read quorum or listing failure stops the protocol. This must include keys absent from `exports.object_key`.
6. Finalize `purged_at` and clear pointers in a transaction only while the writer remains stopped and the event fence still holds. Record the barrier generation and inventory evidence. Resume writers only after they have a fresh non-root identity and DB guards that reject fenced/past-cutoff events. A crash at any phase retries from the fenced state; it never turns an unknown cleanup into success.

The process-exit test on the pinned digest observed a paused PUT reset, a disabled writer rejected before and after restart, and committed objects surviving for later inventory. A separate isolated operator test deleted orphan current objects, versions, delete markers, and multipart uploads (`packages/backend/scripts/O06-PINNED-MINIO-EVIDENCE.md`). The pinned server omitted an active multipart upload from a prefix-filtered listing, so the operator now scans the whole exports bucket for uploads and filters locally. These tests support the protocol but do not prove a complete deployment cutover. Other PUT signers, deployment process enumeration, same-volume all-node restart, restore behavior, and integrated failure recovery remain unverified.

The local configuration now requires `MINIO_EXPORTS_ACCESS_KEY` and `MINIO_EXPORTS_SECRET_KEY` for exports and removes the app's root credential fallback. `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY` remain for assets/imports. Before any live use, provision two distinct non-root identities: the export identity may access only the exports bucket; the shared app identity must have no exports bucket permission. Verify these policies against the pinned server. The maintenance tool must enumerate and stop both API and worker. Bootstrap/admin credentials stay outside both application processes. Local seed scripts with root fallback are operations tools and must not run concurrently with a purge.

## Required implementation and acceptance

- Forward-only migration: persist event/export fence and barrier generation; prevent new/claimed/prepared export writes at cutoff; restrict purge finalization to the operations role after recorded barrier and empty inventory. Preserve tenant-local RLS and narrow cross-tenant definer functions.
- Worker/API: remove root fallback for export PUT, separate writer from admin/delete credentials, and fail closed when cutoff or fence is unknown. Keep download authorization and short signed URL behavior.
- Operations: an idempotent local orchestrator with exclusive lock, positive process-exit checks, MinIO quorum checks, version/multipart inventory, alerts, and resume rules. It must refuse to run if another writer or MinIO node cannot be enumerated.
- Tests: two paused workers and a purge actor at pre-PUT, partial body, post-commit/pre-READY, and reclaim points; both versioning modes; orphan keys; new export at cutoff; crash/restart at each phase; tenant isolation; restore reconciliation. Pin exact SHA and MinIO digest. Review F01 independently on the integrated SHA.

**Decision gate:** do not use the current online `processDueObjectRetentions` to set `purged_at` as final proof. If a bounded maintenance pause is unacceptable or the full process/credential inventory cannot be established, this candidate cannot close F01; use a separate upload broker with demonstrable server drain instead.

## Review-convergence checkpoint

| Field | State |
| --- | --- |
| Finding | F01, correctness blocker on POL-03; discovered at `0df849db`, still open at `d45b1e38` |
| Automatic fix rounds | 2/2 used; no reset across Tasks, Runs, or commits |
| New evidence | Presign expiry can still commit a started PUT; restart-only allows a new PUT; disabled writer plus confirmed process exit rejected old-key PUTs in two isolated runs; versioned DELETE leaves old bytes; isolated pinned operator test proves full version and multipart listing/deletion after a bucket-wide multipart scan |
| Bounded exceptional fix | **Local code and isolated tests complete, acceptance pending.** DB guards, dedicated export credentials, fail-closed worker and operator CLI are in the shared local tree. Owner: coordinator for integration and credential isolation, Backend for DB/worker/operator, independent functional reviewer for exact-SHA F01. Stop on missing maintenance-pause decision, missing deployment inventory, failed version deletion, any late PUT, or absent full barrier proof. |
| Reopen condition | Positive proof on the pinned topology, followed by a single implementation batch and race revalidation. Otherwise remain `Bị chặn`; do not retry a different name for the same failure. |
