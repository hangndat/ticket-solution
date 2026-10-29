# O06 F01 local offline export purge operator

This is an **unaccepted local maintenance candidate**. It is not a scheduled worker job. Do not run it during normal service, deployment, or UAT. The operator must first identify every API, worker, other export PUT signer, operations tool, and MinIO server process from the actual deployment topology. Missing inventory, positive process exit, credential disable, same-volume server restart, or quorum proof stops the run. The JSON file is an operator attestation; this script cannot independently verify process or supervisor state.

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

The DB records that aggregate hash and barrier hashes before finalization in one transaction. A successful rerun repeats empty inventory and returns `alreadyFinalized` without replacing the frozen attestation. If a previously attested generation still has unpurged rows, or if an object reappears after finalization, stop for manual recovery. Keep writers stopped until a successful DB commit, a fresh non-root export PUT identity, and deployed DB guards are confirmed. Never infer the barrier from an HTTP timeout or a restart response.
