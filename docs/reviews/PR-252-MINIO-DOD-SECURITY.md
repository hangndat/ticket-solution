# DoD + Security review — PR #252 MinIO cleanstart pin (ADR-14 O1)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor worker · Roles `reviewer-dod` + `reviewer-security` (`docs/agents/roles/reviewer-dod.md`, `docs/agents/roles/reviewer-security.md`) · terminal `term_9247ad7d-d36c-4a69-80f6-da9b01ab4204` · dispatch `ctx_04c43a91a6ad` · task `task_e6397ed427bb` · worktree `remaining-review-252` |
| Implementer (≠ reviewer) | Branch `hangndat/d5-minio-cleanstart` (PR author) — session khác reviewer |
| Scope | PR [#252](https://github.com/hangndat/ticket-solution/pull/252) · paths `compose.yaml`, `infra/deploy/compose.yaml`, `docs/architecture/object-store-minio-replacement.md`, `docs/DECISION-LOG.md`, `docs/ops/ENV-MANIFEST.md`, `infra/deploy/README.md` |
| Commit SHA (tip under review) | `eb14eef12de3924ccfc24e843d5e7b526d155ec3` |
| Architecture impact | **Có** — đối chiếu `docs/architecture/object-store-minio-replacement.md` (O1 đã chốt) |
| Agent | `cursor` (orca-agent-routing) |
| Graph | `code-review-graph-ticket` `detect_changes_tool` (base=`main`): YAML/docs không map function — **limitation**; verify bằng `git diff` + source/docker |

## Checks (trên exact SHA)

| Check | Result |
| --- | --- |
| Tip PR #252 / `headRefOid` | `eb14eef12de3924ccfc24e843d5e7b526d155ec3` — khớp `gh pr view 252` và commit duy nhất trên branch; reviewer `git checkout --detach` đúng SHA |
| Diff ownership | 6 files compose/docs only (+252/−19); **không** đụng `apps/*`, `packages/backend/src/minio.ts`, lockfile |
| ADR-14 O1 alignment | Pin `cleanstart/minio@sha256:4febd64f632c221b48e0fbf435ac534df822aa5b06805540c03973939e4cc82a`; init `amazon/aws-cli:2.17.50@sha256:ac68e76ae4bbb804b0c36d56c6fdc8e6800adb46d29867ac2b73280225a7b719`; health `/minio/health/live` qua `wget`; Decision Log + ENV-MANIFEST + deploy README cập nhật — khớp handoff architect |
| Image digest local | `docker image inspect` — cả hai digest đã có local, `RepoDigests` khớp pin |
| Binary healthcheck | `docker export` filesystem: image có `/usr/bin/wget` và `/usr/bin/minio`; default `Config.User=65532`, compose override `user: 0:0` (đúng note O1) |
| Isolated runtime smoke (task-specific) | Project/network/volume `pr252rev_*` — **không** đụng volume/`minio_data` hiện có. HEALTH_OK (wget live); INIT_OK 3 buckets; REINIT_OK; PUTGET_OK; anonymous ListObjects → AccessDenied (EC 254); wrong secret → HeadBucket 403 (fail-closed). Cleanup `rm` containers/volume/network OK |
| PR body “api/web 200” / VPS | **Không** dùng làm evidence DoD — task cấm suy health từ PR body; evidence runtime = smoke local ở trên |
| Credentials / secrets | Diff không commit secret; prod compose lấy `MINIO_ROOT_*` từ env; init map sang `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` one-shot; local default `minioadmin` là pre-existing dev default |
| Runtime isolation | Deploy: `networks: internal`, không publish 9000/9001 edge. Local: bind `127.0.0.1` — giữ nguyên |
| Retry / fail-closed init | `s3 mb … \|\| true` rồi `head-bucket` bắt buộc — bucket thiếu hoặc cred sai → container init fail (đã chứng minh BADCRED_EC=254) |
| SaaS object store | Không — `amazon/aws-cli` chỉ client CLI tới endpoint self-host `http://minio:9000`; không AWS S3/R2/B2 runtime (V7) |
| App client | `packages/backend/src/minio.ts` **không** đổi — SigV4 path-style giữ; smoke Put/Get S3 API OK trên image pin |
| CI tip SHA | [run 39059542464](https://github.com/hangndat/ticket-solution/actions/runs/39059542464) · `headSha` = `eb14eef12de3924ccfc24e843d5e7b526d155ec3` · `changes`/`ci`/`d5-*` SUCCESS; `backend`/`database-isolation`/`web`/`mobile` **SKIPPED** (đúng path filter compose/docs) |
| Independence | Reviewer dispatch `ctx_04c43a91a6ad` ≠ implementer; không commit/push/merge từ reviewer |

## Findings

| Severity | Finding |
| --- | --- |
| Known gap (chấp nhận theo O1) | Mirror third-party `cleanstart/minio` — provenance/CVE theo dõi kém official; đã pin digest bất biến và user/architect chốt O1. |
| Should-fix / hardening | `user: '0:0'` nâng quyền so với image default `65532` — cần cho volume/UID theo O1; nên giữ comment/runbook (đã có trong ADR). Không exploitable trên topology internal-only. |
| Nit | Root `compose.yaml` không có `minio-init` (chỉ `infra/deploy/compose.yaml`) — pre-existing; local seed vẫn qua script/test. |
| Limitation | CI không chạy `minio-real.test.cjs` trên PR này (backend skipped). Bù bằng isolated smoke Put/Get + health + init trên đúng digest; **không** coi claim VPS 200 trong PR body là verify. |
| Graph limitation | CRG không index YAML compose hữu ích cho PR này — review dựa diff + docker. |

Không blocker bắt buộc: digest pin, health binary, init fail-closed, bucket private mặc định, không SaaS store, khớp ADR-14 O1, CI path-filter xanh trên exact SHA.

## Threat / abuse cases (security)

| Case | Kết luận |
| --- | --- |
| Anonymous read bucket sau init | AccessDenied — private default thay `mc anonymous set none` |
| Cred sai / thiếu bucket | `head-bucket` fail → init exit ≠ 0 (fail-closed) |
| Edge exposure MinIO | Deploy không publish port; local chỉ loopback |
| Secret trong git | Không có trong diff |
| Supply chain tag float | Cả server và init pin `@sha256:…` |
| Thay store bằng AWS S3 SaaS | Không — chỉ CLI image + endpoint nội bộ |

## Verdict

### DoD: **PASS**
### Security: **PASS**

- Implementation khớp ADR-14 O1 / handoff architect trên exact tip `eb14eef12de3924ccfc24e843d5e7b526d155ec3`.
- Evidence runtime độc lập (task-specific containers) xác nhận healthcheck wget, init aws-cli idempotent, private bucket, Put/Get, fail-closed cred.
- Known gap mirror third-party là chấp nhận có chủ đích theo O1 — không miễn gate bảo mật bắt buộc trong scope.
- Merge / Project `Hoàn thành` → **coordinator** (reviewer **không** merge).

## Revalidation

Commit hành vi mới sau SHA tip → DoD/security lại trên SHA mới; không kế thừa verdict này. Deploy prod MinIO trên VPS vẫn cần evidence ops riêng khi được ủy quyền — ngoài claim trong PR body.
