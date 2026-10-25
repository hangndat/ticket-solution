# #899 — Diễn tập PostgreSQL và release bất biến (25/10/2026)

**Môi trường:** Docker Desktop, PostgreSQL 18.1, Linux arm64/Node 24.22.1; dữ liệu, OIDC/JWKS, SMTP và APNs synthetic trong network `ticket-ar891-93ead9bd`. Không dùng host production, secret thật hoặc migration lỗi trong chain sản phẩm. Đây là evidence implementation của PR #911, chờ reviewer độc lập/CI trên exact head trước acceptance.

## Artifact và hợp đồng schema

| Artifact | Source SHA | Build ID | App range | Migrate input → target |
| --- | --- | --- | --- | --- |
| old | `fb2da38e893881e76a7ef0649ee112220f93fb91` | `cf5b98e134b3` | 1–2 | format 1 legacy, 1–2 |
| new | `9dc165244fcdd6d87edc95654699dd27ff069371` | `065346b34bb9` | 2–2 | 1–1 → 2 |

Old artifact là build đã kiểm trước review; new artifact được build lại sau sửa tooling bằng `python3 scripts/release-artifact.py --root /tmp/ar891-93ead9bd-releases build --sha 9dc165244fcdd6d87edc95654699dd27ff069371 --platform linux/arm64 --schema-min 2 --schema-max 2 --migrate-input-min 1 --migrate-input-max 1 --migrate-target 2`. Build và `verify` exit 0; native `sharp`/Prisma smoke exit 0. Next 16 sinh `BUILD_ID` ngẫu nhiên: manifest chứng minh artifact cụ thể, không chứng minh bit-identical.

Pin CLI trên **new** artifact với DB schema 1: `pin <new> migrate --schema 1` exit 0, `pin <new> api --schema 1` exit 1 và pins file không đổi. Trên schema 2, API/worker new pin exit 0; old API/worker vẫn pin được theo range 1–2. `pnpm test:release` chạy 7/7, gồm format 2 input/target độc lập app range, cleanup container stopped với subdirectory mount, sai/mất/symlink pins file, outside-root/symlink.

## F01/F04 — Prisma deploy và forward repair trên PG thật

`scripts/release-pg-rehearsal.cjs /old /new` chạy trong `vemoki-runtime:local` với hai artifact mount `:ro`. Harness tạo `migration_owner` và `ticket_app` `NOBYPASSRLS`; chạy **lệnh thật** `pnpm --filter @ticket/backend exec prisma migrate deploy` từ old artifact (35 migrations) rồi từ new (thêm `202610250001_ar891_worker_budget`, tổng 36). Không áp SQL migration trực tiếp để thay thế gate. Business fixture dùng `ticket_app`; old issue vé/outbox, old/new đọc sau expand; old relay email `ACCEPTED`, push synthetic `FAILED`, new reclaim và hoàn tất push `ACCEPTED`, old consumer tiếp tục đọc/claim trên schema 2. Email send count 1, push count 2, outbox `COMPLETE`; wrong-tenant query qua RLS trả 0 row.

Fault injection dùng **temporary source tree** ngoài release và production migration chain. Migration `209901010001_ar891_synthetic_failure` tạo column + ghi `PARTIAL` rồi `SELECT 1/0`; Prisma deploy exit khác 0, `_prisma_migrations` có row lỗi, `logs` chứa `division by zero`, dữ liệu `PARTIAL` tồn tại sau process. Repair SQL tiến tới đổi `PARTIAL` thành `REPAIRED` với predicate idempotent; chạy hai lần không đổi dữ liệu. `prisma migrate resolve --applied` ghi nhận phần đã sửa; Prisma đánh dấu row lỗi `rolled_back_at` **trong metadata**, nhưng không chạy SQL down/restore và column/data vẫn tồn tại. Migration synthetic kế tiếp `209901010002_ar891_synthetic_forward_repair` chạy qua `migrate deploy`; deploy lặp exit 0, dữ liệu không đổi. PG cuối có 36 migration sản phẩm và 2 migration synthetic thành công, một row lỗi historical; outbox vẫn `COMPLETE|REPAIRED`, old/new consumer đọc cùng trạng thái, sai tenant 0 row. Cả hai migration synthetic được xóa cùng temporary source tree sau harness.

Lệnh chính (thay path/network cho fixture):

```sh
docker network create --label ticket.task=task_93ead9bd28b9 ticket-ar891-93ead9bd
docker run -d --name ticket-ar891-93ead9bd-final2-pg --label ticket.task=task_93ead9bd28b9 --network ticket-ar891-93ead9bd -e POSTGRES_PASSWORD=synthetic-local-only -e POSTGRES_DB=release_rehearsal postgres:18.1-alpine
python3 scripts/release-artifact.py --root /tmp/ar891-93ead9bd-releases pin 9dc165244fcdd6d87edc95654699dd27ff069371-065346b34bb9 migrate --schema 1 --pins /tmp/ar891-93ead9bd-pins.env
docker run --rm --network ticket-ar891-93ead9bd -e RELEASE_PG_URL=postgresql://postgres:synthetic-local-only@ticket-ar891-93ead9bd-final2-pg:5432/release_rehearsal -v "$PWD":/repo:ro -v /tmp/ar891-t5-pg-rehearsal-releases/fb2da38e893881e76a7ef0649ee112220f93fb91-cf5b98e134b3:/old:ro -v /tmp/ar891-93ead9bd-releases/9dc165244fcdd6d87edc95654699dd27ff069371-065346b34bb9:/new:ro -w /repo vemoki-runtime:local node scripts/release-pg-rehearsal.cjs /old /new
```

## F03 — Process thật, Compose mount và đổi pin riêng

`scripts/fixtures/release-compose.yaml` khởi động `api_a`, `api_b`, `worker`, `web`, `portal` theo entrypoint production với release `/app:ro`; state `/app/apps/web/.data` và Next cache là bind mount writable riêng. Web/portal HTTP `/` đều 200, `docker inspect` xác nhận `/app=false`, `.data`/cache `true`. PG cùng network có ticket/outbox seed bằng `scripts/release-pg-daemon-seed.cjs`; worker daemon old và sau đó new gửi qua Mailpit local, outbox mỗi ticket `PENDING → COMPLETE`, notification email `ACCEPTED`. SQL fault fixture đặt lease `PROCESSING` hết hạn; daemon reclaim về `COMPLETE`, counter `relay_outbox` tăng từ 2→3 rồi 3→4, Mailpit message count vẫn 1 rồi 2, không gửi trùng sau reclaim. Provider `ACCEPTED` chỉ chứng minh Mailpit local nhận.

Trước đổi pin A: API B container ID `c00c38ad4bf8…`, mount old `/app:ro`, checksum `apps/api/dist/main.js` = `8f43a56654186812d0c152490b40a11518cc94834d8c56aaea6224842313e0b9`, health 200. `pin <new> api --schema 2` rồi `docker compose -p ar891-93ead9bd -f scripts/fixtures/release-compose.yaml --env-file /tmp/ar891-93ead9bd-fixture.env --env-file /tmp/ar891-93ead9bd-pins.env up -d --no-deps --force-recreate api_a`: A thành ID `4af0d12ed470…`, manifest `9dc16524…:065346b34bb9`, mount new `/app:ro`, health 200. B giữ **cùng container ID, mount, checksum và health 200** sau A recreate. Sau đó pin/recreate worker new độc lập; daemon trên new artifact hoàn tất ticket tiếp theo và reclaim.

Canary business HTTP dùng `scripts/release-oidc-fixture.cjs` trong network cô lập, RS256 JWT có `iss/aud/sub/email_verified` khớp identity fixture và JWKS remote thực; API không bypass auth production. Trên A new và B old, `GET /v1/me/tickets?tenantId=cccccccc-cccc-4ccc-8ccc-cccccccccccc` với Bearer token trả 200, một ticket `ACTIVE` cùng PG. `/v1/health` của cả hai cũng 200. Public `GET /v1/public/tenants/apns-652/events` trả 500 ở cả hai revision: `ticket_app` không được `SET LOCAL ROLE ticket_platform_runtime` theo `infra/deploy/init-db.sh`; đây là phát hiện riêng ngoài scope #899, không cấp quyền giả cho fixture hay sửa business/RLS trong PR này.

## Giới hạn và cleanup

Rehearsal dùng provider/OIDC synthetic, lease crash ở SQL durable boundary chứ không kill process, và không chạy staging/production. `cleanup --execute` kiểm mọi Docker container kể cả stopped và mount con; local test tạo container stopped thật với submount, xác nhận release không bị xóa. Không xóa fixture/container ngoài task này. Chỉ contract schema khi old consumer đã dừng; không diễn tập hoặc đề xuất rollback database destructive.
