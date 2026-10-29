# O06 F01 local offline export purge operator

This is an **unaccepted local maintenance candidate**. It is not a scheduled worker job. Do not run it during normal service, deployment, or UAT. The operator must first identify every API, worker, other export PUT signer, operations tool, and MinIO server process from the actual deployment topology. Missing inventory, positive process exit, credential disable, same-volume server restart, or quorum proof stops the run. The JSON file is an operator attestation; this script cannot independently verify process or supervisor state.

## Due-event discovery and ownership

The **retention operations on-call** owns the recurring `check` run, its alert, and the
per-event maintenance ticket. Run the first check immediately after migration
`202610290007_o06_operator_due_events`; its set-based scan includes events that
were already overdue before deployment. Schedule a check at least once every
15 minutes on an operations host with the dedicated DB login, and retain its
NDJSON stdout and exit status in the operations log. The DB login must be able
to `SET ROLE ticket_retention_operator`. This schedule is an operator task;
neither the API nor the worker invokes the command.

```sh
O06_OPERATOR_DATABASE_URL='postgresql://<operator>...' \
  node packages/backend/scripts/o06-offline-purge.cjs check --limit 200
```

`plan` has the same read-only output for an ad hoc inventory. Each `event` line
contains tenant/event IDs, the day-90 deadline, `pending` or `completed`, fence
generation, inventory marker, unpurged row count, and an overdue flag. The final
`summary` line contains `O06_EXPORT_RETENTION_OVERDUE` when any pending event is
at or past the deadline, or `O06_EXPORT_RETENTION_DUE` when a day-89 event needs
maintenance. Both commands exit **2** for overdue, **3** for pending due, **0**
when all scanned events are complete, and **1** on query/role failure. The
scheduler must alert the on-call for exits 1, 2, or 3 and for missing runs. A pending
event with zero export rows still needs a full prefix inventory: DB rows cannot
prove that orphaned MinIO objects are absent. `ends_at IS NULL` is excluded;
cancelled events use `ends_at`, never `cancelled_at`.

For each pending event, the on-call records a stable generation, arranges an
approved maintenance window before the deadline, and follows the fence and
purge procedure below. If already overdue, escalate immediately and keep the
alert open until the event is completed and a fresh check clears it. The check
does not stop processes, disable credentials, touch MinIO, fence, or finalize.
The operator must arrange and verify those actions separately with the actual
deployment owner; an unattended scheduler must never invoke `fence` or `purge`.

## Invocation

Use a dedicated login principal that can `SET ROLE ticket_retention_operator`, not `ticket_runtime` or the migration owner. The migration grants the role only the F01 definer functions. Keep the same UUID generation across retries. Run `fence` before stopping writers, then keep writers stopped through `purge` and the final DB commit.

```sh
O06_OPERATOR_DATABASE_URL='postgresql://<operator>...' \
  node packages/backend/scripts/o06-offline-purge.cjs fence \
  --tenant <tenant-uuid> --event <event-uuid> --generation <stable-uuid>

O06_OPERATOR_DATABASE_URL='postgresql://<operator>...' \
O06_MINIO_ADMIN_ENDPOINT='https://<minio-admin-endpoint>' \
O06_MINIO_ADMIN_ACCESS_KEY='<separate-admin-access-key>' \
O06_MINIO_ADMIN_SECRET_KEY='<separate-admin-secret-key>' \
O06_MINIO_EXPORTS_BUCKET='<exports-bucket>' \
  node packages/backend/scripts/o06-offline-purge.cjs purge \
  --tenant <tenant-uuid> --event <event-uuid> --generation <stable-uuid> \
  --evidence /absolute/path/to/positive-barrier-evidence.json
```

`fence` succeeds only from `ends_at + 89 days`. The DB function retains the generation. Record that UUID outside the application and use it for every retry. `purge` requires an already fenced event and a generation match. The script does not read event rows directly across tenant RLS. Its session advisory lock prevents concurrent copies of this operator for the same event.

## Required barrier evidence

The file must be prepared after the process-level stop, writer identity disable, restart inhibition, stop of operations tools that can write exports, exit of **all** MinIO server processes, same-volume restart, and read/write quorum recovery. Each `proof` string should identify a durable process or supervisor record; plain timeout/restart responses do not count. `expectedWriterIds` and `expectedMinioNodeIds` must come from the full deployment inventory and exactly match the process entries. Include every API and worker process, plus every other export signer as a writer entry. An unknown process or topology requires human investigation before the run proceeds.

```json
{
  "tenantId": "<tenant-uuid>",
  "eventId": "<event-uuid>",
  "generation": "<stable-uuid>",
  "writerIdentityDisabled": true,
  "writerIdentityDisabledAt": "2026-10-29T06:00:30Z",
  "writerIdentityDisableProof": "<identity-disable-record-id>",
  "writerRestartInhibited": true,
  "writerRestartInhibitProof": "<supervisor-mask-record-id>",
  "operationsToolsStopped": true,
  "operationsToolsStopProof": "<ops-process-inventory-record-id>",
  "expectedWriterIds": ["api-1", "worker-1"],
  "writers": [
    {"id":"api-1","role":"api","pid":101,"exitConfirmed":true,"exitedAt":"2026-10-29T06:00:00Z","proof":"<process-exit-record-id>"},
    {"id":"worker-1","role":"worker","pid":102,"exitConfirmed":true,"exitedAt":"2026-10-29T06:00:00Z","proof":"<process-exit-record-id>"}
  ],
  "expectedMinioNodeIds": ["minio-1"],
  "minioNodes": [
    {"id":"minio-1","pid":201,"exitConfirmed":true,"exitedAt":"2026-10-29T06:01:00Z","proof":"<process-exit-record-id>"}
  ],
  "minioRestartedSameVolumes": true,
  "minioRestartedAt": "2026-10-29T06:02:00Z",
  "sameVolumesRestartProof": "<volume-mount-and-boot-record-id>",
  "observedAt": "2026-10-29T06:03:00Z"
}
```

The time fields must describe the observed sequence; substitute real times and records. Keep the evidence file unchanged across a failed retry until the reason is investigated. Protect it as operations evidence, without secrets or user data.

## Purge and recovery

The tool checks both MinIO read and write quorum, then lists the event-derived prefix across current objects, every data version and delete marker, and incomplete multipart uploads. The pinned MinIO image returned no multipart uploads when `ListMultipartUploads` used a prefix even while an active upload existed, so this tool paginates the **whole exports bucket** for uploads and filters the exact event prefix locally. It deletes explicit version IDs and upload IDs, including keys absent from `exports.object_key`, and requires two consecutive empty full inventories. Listing, pagination, deletion, health, or DB errors exit nonzero without finalization. The JSON result includes each pass count and hash plus an aggregate inventory hash. Store stdout with the operator evidence and alarm if the event reaches `ends_at + 90 days` before completion.

The DB records that aggregate hash and barrier hashes before finalization in one transaction. A successful rerun repeats empty inventory and returns `alreadyFinalized` without replacing the frozen attestation. After PostgreSQL or MinIO PITR, establish a fresh process/key/server barrier before rerunning `purge`; the rerun inventories and removes restored current objects, versions, markers, and multipart uploads even when `purged_at` was already set, and returns `reconciled: true` if it found bytes. Keep writers stopped until a successful DB commit, a fresh non-root export PUT identity, and deployed DB guards are confirmed. Never infer the barrier from an HTTP timeout or a restart response.
