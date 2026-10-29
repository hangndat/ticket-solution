# O06 F01 isolated MinIO operator check — 2026-10-29

This is local test evidence, not proof of a deployment barrier or an F01 acceptance verdict. The test used a disposable Docker container and removed it afterward; no live compose service or maintenance process was touched.

## Pin and commands

- Image: `cleanstart/minio@sha256:4febd64f632c221b48e0fbf435ac534df822aa5b06805540c03973939e4cc82a` (same digest as `infra/deploy/compose.yaml`).
- `docker image inspect cleanstart/minio@sha256:4febd64f632c221b48e0fbf435ac534df822aa5b06805540c03973939e4cc82a --format '{{.Id}}'` → `sha256:4febd64f632c221b48e0fbf435ac534df822aa5b06805540c03973939e4cc82a`.
- `pnpm --filter @ticket/backend test:o06-operator` → 10 pass, 0 fail.
- `pnpm --filter @ticket/backend test:o06-operator-minio` → 1 pass, 0 fail, duration 10.17 s.
- `git diff --check` → exit 0.

The integration test starts the pinned image on a random loopback port and uses a separate cached `amazon/aws-cli:2.17.50` container to create one fixture bucket and objects. It verifies both read and write quorum endpoints, signed `ListObjectsV2`, `ListObjectVersions`, `ListMultipartUploads`, explicit version deletion, and multipart abort through `s3Client`. It exercises unversioned and versioned bucket states, an orphan key under the event prefix, two object versions, a delete marker, and an incomplete upload with one part. Each state converges to two empty inventories after deletion.

## Pinned behavior and operator adaptation

For an active upload whose part was confirmed by `list-parts`, `aws s3api list-multipart-uploads --bucket ... --prefix <event-prefix>` returned no `Uploads`. The same request without `--prefix` returned the upload ID and key. The test asserts both observations. The operator therefore scans **all** uploads in the exports bucket with bounded pagination, then filters keys by the event prefix locally before deleting. The image also exposes an unversioned object in `ListObjectVersions` with `VersionId=null`; the operator deletes it with an explicit version ID.

The JSON process-exit evidence remains an operator-supplied attestation. No real API/worker exit, all-node MinIO process exit, same-volume restart, credential isolation, deployment topology inventory, paused-writer race, or restore reconciliation was executed by this test. F01 remains open until those external barriers and the integrated race proof are demonstrated.
