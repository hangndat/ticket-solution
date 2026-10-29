# O06 F01 — isolated MinIO identity check, 2026-10-29

This is **local evidence**, not verification of identities or policies on the deployment. The server was a disposable `cleanstart/minio@sha256:4febd64f632c221b48e0fbf435ac534df822aa5b06805540c03973939e4cc82a` container with a random loopback port. It was stopped and removed after the check. The cached `cgr.dev/chainguard/minio` image supplied `mc`; the pinned `amazon/aws-cli:2.17.50` image made S3 PUT requests. All identities and object bodies were disposable fixtures.

The operator created `vemoki-exports`, `vemoki-assets`, and `vemoki-imports`, then attached [o06-exports-writer.json](../../infra/deploy/minio-policies/o06-exports-writer.json) to `fixtureexport` and [o06-shared-assets-imports.json](../../infra/deploy/minio-policies/o06-shared-assets-imports.json) to `fixtureapp`. No application identity was root. Observed S3 results:

| Identity | Bucket | PUT result |
| --- | --- | --- |
| `fixtureexport` | `vemoki-exports` | 200 / object ETag |
| `fixtureexport` | `vemoki-assets` | `AccessDenied` |
| `fixtureapp` | `vemoki-assets` | 200 / object ETag |
| `fixtureapp` | `vemoki-exports` | `AccessDenied` |
| `fixtureexport` after `mc admin user disable` | `vemoki-exports` | `InvalidAccessKeyId`, account disabled |

This proves that the **policy templates** can isolate export PUTs and that the pinned server rejects a disabled non-root writer in the isolated topology. It does not prove that the live API/worker use these distinct identities, that the shared live identity lacks inherited exports permissions, or that a PUT already in flight was drained. Before a live purge, inspect effective user/group policies and credentials on the actual pinned deployment, test allowed and denied PUTs with harmless fixtures, disable the export writer, and retain receipts with the process barrier evidence. If bucket names differ from the defaults, render policies for those names and repeat the tests.
