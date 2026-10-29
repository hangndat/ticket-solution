# O06 F02 export writer barrier contract

`EXPORT_WRITES_PAUSED=1` rejects API export create/download with 503 and makes the
worker skip export claims before loading the export identity. It is read from
each process environment; changing a deployment file does not change a running
process. Status/list stay available. The worker holds the event row lock across
the final eligibility check, PUT, and READY commit. The PUT timeout is 40 s and
the transaction cap is 45 s; preparation uses the normal 10 s transaction cap,
keeping one `relay_exports` action within its 60 s step budget. A timeout or
connection loss can still leave an orphan or late server commit.

## Release and purge sequence

1. Before migration `202610290006_o06_offline_export_fence`, inhibit all old API
   and worker supervisors and positively confirm every old process exited on
   every host. Migration 006 removes the old two-argument claim function. Do not
   overlap old and new workers. Deploy the new API/worker with
   `EXPORT_WRITES_PAUSED=1`; prove create is 503 and no worker claim occurs.
2. Keep the dedicated export key disabled at MinIO while offline purge runs.
   Revoking configuration or changing an environment variable alone is not a
   key disable. Confirm the effective policy/key state on the target, including
   inherited grants, and make a signed write attempt with the retired key fail.
   The shared API/import/asset key must have no export-bucket write access.
3. For each due event, call `fence` with a stable generation. Stop API/worker
   processes and operations tools, inhibit restart, disable the export key,
   confirm process exits, then restart every MinIO node on the same volumes.
   This drains requests that might complete after a client timeout or process
   death. Supply the positive topology, chronology and key receipts in the
   operator evidence JSON. Only then run `purge`.
4. `purge` lists current objects, every version/delete marker, and in-progress
   multipart uploads under the event prefix; deletes them and requires two
   empty inventories before recording evidence and setting `purged_at`. Keep
   the retired key disabled permanently. A new least-privilege export identity
   may be issued only to the new process generation after the purge window.
   The DB event fence prevents that generation from claiming the purged event.
5. After PostgreSQL or MinIO PITR, start with API/worker paused and the export
   key disabled. Reconcile every due/fenced event before enabling writers. The
   same `purge` command now removes restored objects even when DB rows already
   carry `purged_at`; retain its `reconciled` output as a recovery receipt. If
   the DB restore predates the fence, re-fence with a stable generation and
   purge. Do not treat an empty DB inventory as proof that MinIO is empty.

The JSON evidence is an operator attestation, not automatic discovery of the
VPS process topology or effective MinIO credentials. F02 deployment closure
requires target-host process/supervisor/key receipts and an independent
exact-SHA review. Local tests do not establish those facts.
