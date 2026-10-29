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

This spans two app process generations: the old generation (schema 35–40
pins, two-argument `claim_exports_batch`) and the new generation (this
migration's schema-50 manifests, three-argument `claim_exports_batch`, and
the fence/purge functions below). The new generation's manifest declares app
min/max schema **50** and `migrate` inputMin/inputMax **41** / target **50**;
starting the new API/worker before migration
`202610290006_o06_offline_export_fence` reaches schema 50 is out of its
declared range, not merely unsafe. The explicit boundary in part A exists to
prevent that; do not read its steps as able to run in any other order.

### A. Deploy generation boundary (one-time, schema 41→50 cutover)

1. After the exact-SHA code/plan review passes, build and verify the new
   generation in staging without touching a running app mount, then take a
   fresh PostgreSQL + MinIO backup before any pin, Compose recreate or
   migration. Confirm the artifact's Linux/Node 24 ABI, five service schema
   ranges and current DB ledger under the `deploy-prod` gate before the
   maintenance window opens.
2. Inventory MinIO identities and create the dedicated export-writer identity
   and least-privilege policies (`infra/deploy/MINIO-IDENTITY-PROVISION.md`
   §§1–3) ahead of the maintenance window. Do **not** yet attach the
   restrictive assets/imports-only policy to the key the old generation is
   still signing exports with, or install the new export key into any running
   signer — either would disrupt the still-live old writers.
3. At the maintenance window, inhibit all old API and worker supervisors and
   every other export signer, and positively confirm every old process exited
   on every host. Only once every old process has exited, remove all
   export-capable old credentials — attach the restrictive policy to the
   previously shared key, verify the effective policy and live allow/deny
   matrix, then disable the new export identity
   (`infra/deploy/MINIO-IDENTITY-PROVISION.md` §§4–7). Keep it disabled
   through migration and purge. Do not overlap old and new workers.
4. Restart every MinIO node on the same volumes **after** the key/policy
   barrier. This drains any PUT that
   began before a client timeout or process exit but might still complete
   after it.
5. Migrate 41→50 only now, after steps 3–4 complete: pin `migrate` with
   `--schema 41` (current DB input), run it once, wait for exit 0, and confirm
   the ledger reaches 50/50. Migration 48 drops the old two-argument
   `claim_exports_batch` here — this is why steps 3–4 must already be
   complete before this step runs, not after it.
6. Only after the ledger confirms schema 50, pin and recreate the new
   API/worker with `EXPORT_WRITES_PAUSED=1`; prove create is 503 and no worker
   claim occurs. This is the earliest point the new generation may run at
   all — never before step 5 exits 0.

### B. Per-event fence and purge (steady state, after the boundary above)

Each later due event requires its own temporary writer-stop / key-disable /
MinIO-restart window against the then-current (new) generation; this is
separate from the one-time cutover boundary in part A, and the same evidence
requirements apply.

1. Keep the dedicated export key disabled at MinIO while offline purge runs.
   Revoking configuration or changing an environment variable alone is not a
   key disable. Confirm the effective policy/key state on the target, including
   inherited grants, and make a signed write attempt with the retired key fail.
   The shared API/import/asset key must have no export-bucket write access.
2. For each due event, call `fence` with a stable generation. Stop API/worker
   processes and operations tools, inhibit restart, disable the export key,
   confirm process exits, then restart every MinIO node on the same volumes.
   This drains requests that might complete after a client timeout or process
   death. Supply the positive topology, chronology and key receipts in the
   operator evidence JSON. Only then run `purge`.
3. `purge` lists current objects, every version/delete marker, and in-progress
   multipart uploads under the event prefix; deletes them and requires two
   empty inventories before recording evidence and setting `purged_at`. Keep
   the retired key disabled permanently. A new least-privilege export identity
   may be issued only to the new process generation after the purge window.
   The DB event fence prevents that generation from claiming the purged event.
4. After PostgreSQL or MinIO PITR, start with API/worker paused and the export
   key disabled. Reconcile every due/fenced event before enabling writers. The
   same `purge` command removes restored objects even when DB rows already
   carry `purged_at` only with an operator-attested PITR reason in the fresh
   barrier evidence. Retain its `reconciled` output, stderr
   `O06_PITR_RESTORE_RECONCILED` alert and distinct exit code 4 as recovery
   receipts; an unexplained reappearance fails before deletion. If
   the DB restore predates the fence, re-fence with a stable generation and
   purge. Do not treat an empty DB inventory as proof that MinIO is empty.

The JSON evidence is an operator attestation, not automatic discovery of the
VPS process topology or effective MinIO credentials. F02 deployment closure
requires target-host process/supervisor/key receipts and an independent
exact-SHA review. Local tests do not establish those facts.
