# MinIO non-root identity provisioning/verification (O06 F03)

**Target-host procedure only.** Every command below mutates the live MinIO server and must run under the `deploy-prod` gate (`.agents/skills/deploy-prod/SKILL.md`), with explicit task authorization — none of it has been executed against a real host from this document. The disposable local rehearsal that validated this exact sequence (allow/deny matrix + disabled-key negative test) is `.artifacts/f03-minio-identity-provision.md` / `.artifacts/f03-minio-identity-provision.mjs`. Policy files: `infra/deploy/minio-policies/o06-exports-writer.json`, `infra/deploy/minio-policies/o06-shared-assets-imports.json` — edit the ARNs first if a deployment uses bucket names other than `vemoki-exports` / `vemoki-assets` / `vemoki-imports`.

**No secret values in commands, logs, or evidence.** Generate `MINIO_EXPORTS_ACCESS_KEY` / `MINIO_EXPORTS_SECRET_KEY` out of band (e.g. `openssl rand -hex 20`) and place them directly into `/opt/vemoki/.env` (mode `600`) — never as a literal in a shell history line, a pasted chat message, or a committed file. Every `mc` invocation below reads credentials from an `mc alias` already configured on the operator's own session (`mc alias set <alias> <endpoint> <access> <secret>` run once, interactively, off-screen from any log capture) or from env vars consumed by the shell directly — do not echo them.

Run policy-file commands in steps 1–6 from `/opt/vemoki/src`, so `infra/deploy/minio-policies/...` resolves to the reviewed checkout. Step 7 changes to `/opt/vemoki/src/infra/deploy` for Compose.

## Current state (per `.artifacts/pr1028-rollout-packet-41-50-1ab21d75.md`)

Only `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` are present in the `.env` inventory. `MINIO_EXPORTS_ACCESS_KEY` / `MINIO_EXPORTS_SECRET_KEY` are **absent** — today the shared app key signs export PUTs too, so until this procedure runs, export writes are not isolated from asset/import writes.

## 1. Inventory before touching anything

```sh
mc admin user list   <alias>   # expect only root + the one shared app key; flag any other entry
mc admin group list  <alias>   # expect empty; a non-empty group needs inspection before step 3
mc admin user info   <alias> <current-shared-access-key>
mc admin policy entities <alias>   # confirms what is currently attached to the shared key
```

Stop and investigate before continuing if any identity, group, or policy appears that is not accounted for in `/opt/vemoki/.env` or this doc — do not assume it is safe to ignore or overwrite.

## 2. Apply least-privilege policies (idempotent)

```sh
mc admin policy create <alias> o06-shared-assets-imports infra/deploy/minio-policies/o06-shared-assets-imports.json
mc admin policy create <alias> o06-exports-writer        infra/deploy/minio-policies/o06-exports-writer.json
```

`policy create` with the same name + file content is safe to rerun; it does not touch any user. If bucket names differ from the defaults, edit the ARNs in the JSON files first and re-run `policy create` to update them in place.

## 3. Provision the two identities

Check before creating — **re-adding an existing user can reset its secret**, which would silently break whatever is already signing with it:

```sh
mc admin user info <alias> <shared-access-key>
mc admin user info <alias> <export-access-key>
```

Run `mc admin user add` only after `user info` explicitly reports that the named user does not exist; a network, authentication, or server error must stop the procedure. If the current shared `MINIO_ACCESS_KEY` already exists and is the intended shared identity, do **not** re-run `user add` for it — only attach/confirm its policy (step 4). Only mint a brand-new access key pair for the export writer; it must not reuse or derive from the shared key.

## 4. Attach policies (idempotent)

```sh
mc admin policy attach <alias> o06-shared-assets-imports --user <shared-access-key>
mc admin policy attach <alias> o06-exports-writer        --user <export-access-key>
```

Re-running `attach` with the same policy/user pair is a no-op, not an error.

## 5. Verify effective policy before signing anything live

```sh
mc admin user info <alias> <shared-access-key>   # PolicyName must be exactly o06-shared-assets-imports; MemberOf must be []
mc admin user info <alias> <export-access-key>   # PolicyName must be exactly o06-exports-writer; MemberOf must be []
mc admin group list <alias>                       # re-check for an inherited group grant introduced in step 3/4
```

A `MemberOf` entry, an unexpected `PolicyName`, or a newly non-empty group list means the identity does not have the isolated grant this procedure intends — do not proceed to rotate signer env vars until resolved.

## 6. Allow/deny proof with harmless synthetic fixtures (live, but non-production objects)

Use a throwaway key under a dedicated prefix (e.g. `f03-verify/<date>.txt`) and delete it immediately after each check — never a real export/asset/import object.

```sh
echo f03-verify | mc pipe <shared-alias>/vemoki-assets/f03-verify.txt     # expect success
echo f03-verify | mc pipe <shared-alias>/vemoki-imports/f03-verify.txt   # expect success
echo f03-verify | mc pipe <shared-alias>/vemoki-exports/f03-verify.txt   # expect AccessDenied
echo f03-verify | mc pipe <export-alias>/vemoki-exports/f03-verify.txt   # expect success — then delete the object
echo f03-verify | mc pipe <export-alias>/vemoki-assets/f03-verify.txt    # expect AccessDenied
mc rm <shared-alias>/vemoki-assets/f03-verify.txt <shared-alias>/vemoki-imports/f03-verify.txt <export-alias>/vemoki-exports/f03-verify.txt
```

Record the pass/fail of each line (not the object bytes) as the live receipt required to close F03 — see `.artifacts/review-pr1028-dod-1ab21d75.md` F03.

## 7. Cut API/worker over to the distinct export key after schema 50

Only after step 6 passes:

1. Add `MINIO_EXPORTS_ACCESS_KEY` / `MINIO_EXPORTS_SECRET_KEY` to `/opt/vemoki/.env` (the new export identity from step 3).
2. Stop and positively drain every old API/worker export signer before migration 006; inhibit supervisor restarts. The new release requires schema 50 and must not be started on schema 41. Keep the export key disabled while purge runs.
3. After migration reaches schema 50 and the exact release is verified, set `EXPORT_WRITES_PAUSED=1` for both new services. From `infra/deploy`, use both env files and recreate `api` and `worker` **one service at a time** with `up -d --no-deps --force-recreate <service>`; verify the paused API rejects export create/download and the worker claims no export jobs.
4. Keep both services paused through the key disable and purge in step 8. Do not run a successful export smoke until step 9.

## 8. Disable the export key for an offline purge (barrier)

Immediately before the barrier evidence file required by `packages/backend/scripts/O06-OFFLINE-PURGE.md` is assembled, after API/worker and all other export signers are confirmed stopped:

```sh
mc admin user disable <alias> <export-access-key>
mc admin user info    <alias> <export-access-key>   # Status: disabled — this is the writerIdentityDisabled evidence
```

A disabled identity fails at credential validation (`Your account is disabled`) before any S3 call reaches the bucket — stronger than relying on an application-level stop. Record the command and its output (no secret values appear in either) as `writerIdentityDisableProof`.

## 9. Recovery after purge

Keep the retired export key disabled permanently. After purge and reconciliation receipts pass, mint a fresh access key/secret pair, attach `o06-exports-writer`, verify the allow/deny matrix again, and update `MINIO_EXPORTS_ACCESS_KEY` / `MINIO_EXPORTS_SECRET_KEY`. Recreate `api` and `worker` one service at a time with the pause removed, then verify one export job reaches `READY` and downloads. Rotate the shared key out of band if it previously had broader export access, verify its effective assets/imports-only policy, and recreate each consumer with the new secret. If issuing a fresh export identity fails, keep exports paused and investigate; do not re-enable the retired key to bypass the barrier.

## Idempotent rerun / recovery from a partial failure

Steps 2–5 are safe to repeat after confirming the target identity and policy contents: `policy create` with unchanged content and `policy attach` with the same pair do not rotate a key. Step 3 permits `user add` only for an explicit user-not-found response; all other errors stop the procedure. Never run `mc admin user add` on an existing user because it may reset its secret.
