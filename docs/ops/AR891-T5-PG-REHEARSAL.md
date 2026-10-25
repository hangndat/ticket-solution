# #899 — Local PostgreSQL rehearsal (25/10/2026)

**Phạm vi:** fixture PostgreSQL 18.1 cô lập trên Docker Desktop, Linux arm64/Node 24.22.1, dữ liệu và provider synthetic. Không chạm VPS, staging, production, signing hay secret thật. Đây là evidence implementation cho PR #911, chờ reviewer độc lập và CI trên head mới trước khi gọi acceptance complete.

## Artifact và manifest đã verify

Build bằng `scripts/release-artifact.py` từ hai source SHA **đều là hậu duệ F02**. Source cũ `fb2da38e893881e76a7ef0649ee112220f93fb91` có API/worker trước migration F03; source mới `4471b7bc2594428fa60cd34f85e9f019965d8e66` có F03 và F04. Hai release cùng lockfile SHA256 `8f7c245120cdfc5ede06ead992e640ac688b6ac6e69942e62eba45b32fbad002`, builder image ID `sha256:3d89ec945d5a649adefc44f3bd18d3e3ad37809d887e5822ccb1b5139a9a54db`. `sharp` và Prisma client được smoke trong image Linux sau build; `verify` kiểm mọi file/symlink trước publish. Next 16 tạo `BUILD_ID` ngẫu nhiên: đây là hai artifact được pin/checksum, không phải chứng minh build bit-identical.

| Source | Build ID | Schema khai báo | API digest | Worker digest |
| --- | --- | --- | --- | --- |
| `fb2da38e893881e76a7ef0649ee112220f93fb91` | `cf5b98e134b3` | 1–2 | `0f8de864cd836f939bb1ad8c8379feda65500e6beeee20bdcf0ba918b07c1a9b` | `f7324c52dfc940b42ae2e9a9e7453ef0148705d3b87922aae311df1e45172255` |
| `4471b7bc2594428fa60cd34f85e9f019965d8e66` | `a0123bc447b7` | 2 | `66fa64a50de5cd24f3123536b7e73187e0f75c81c3b6ad71e0056835ce094a81` | `472c0366218ec48e7a6d1a5a02711f13c4e6c611cac0f13a642e1fd107fe8248` |

Source cũ thử đầu tiên `0ccd7b509e9a0ab6d41ca4e612bd82ab7b381d8c` **không** là hậu duệ commit F02 `710b5714…`, nên không dùng cho rehearsal chính. `pin worker --schema 2` từ artifact ấy trả exit 1 với `legacy worker rollback is forbidden after F02 pending-push semantics`. Đây là negative gate, không phải rollback được phép.

## PG/RLS và rollout

`scripts/release-pg-rehearsal.cjs` chạy trong image Node 24 Linux, mount read-only cả hai artifact, dùng migration SQL từ artifact cũ rồi áp dụng migration additive thật của artifact mới `202610250001_ar891_worker_budget`. Fixture tạo role không `BYPASSRLS`, tenant/event/inventory, user/device synthetic và issue ticket bằng backend revision cũ. Sau migration, API data access của **cả hai revision** đọc được row `PENDING` trên cùng PG.

Worker cũ chạy một delivery email `ACCEPTED`, push `FAILED` retryable; outbox vẫn `PENDING`, không false `COMPLETE`. Harness đặt lease `PROCESSING` hết hạn để mô phỏng worker chết ở durable boundary, giữ nguyên ack email rồi cho worker mới reclaim: `claimed=1`, `completed=1`, email `ACCEPTED`, push `ACCEPTED`, outbox `COMPLETE`; email send count vẫn 1, push count 2 (một lần fail và một lần accept), reclaim counter PG tăng. Sau đó chạy worker cũ trở lại trên schema đã expand và row hoàn tất: `claimed=1`, `completed=1`, không gửi lại email/push. Không chạy down migration; schema tiến tới vẫn giữ nguyên.

Hai container Node riêng cùng load backend từ read-only artifact. Khi service A đổi pin từ old sang new và recreate, service B tiếp tục chạy với mount old (`docker inspect`: `RW=false`); SHA256 `/app/apps/worker/dist/worker-relay.js` của B trước/sau là `2f2f23e8b4f33bade33631d628446d61d3d1f4fc8df65fca2a02be9f32b2a107`. A đọc bản new khác checksum `39a7bbb80ec90bc7b239be57c37f5449879512a4e7a6b740e87c9e7de5d75875`. Pin A lại old trên schema 2, recreate và xác nhận cả hai container vẫn chạy từ old read-only. `pin api --schema 3` về old bị chặn với `target service is incompatible with current schema; forward recovery required`; pin file không đổi. `cleanup` release old đang pin bị chặn.

## Giới hạn và tái chạy

| AC #899 | Evidence local | Giới hạn |
| --- | --- | --- |
| Deploy A không đổi B, provenance runtime | Hai release read-only, pin riêng; `docker inspect` mount A/B và checksum B trước/sau recreate trùng nhau. | Container mount smoke load backend, chưa chạy HTTP service đầy đủ. |
| Expand/contract và app cũ/mới đồng tồn | Migration PG F03 additive; old/new backend đọc cùng row; old API issue, old/new worker relay. | Chưa chạy contract migration hoặc staging rollout. |
| App rollback / forward recovery schema | Rollback pin/schema 2 và worker cũ PASS; schema 3 bị chặn, giữ schema expand, không down migration. | Forward recovery sau migration lỗi chưa fault-inject; cần release sửa riêng khi xảy ra. |
| Runbook lỗi/cleanup/secrets | `IMMUTABLE-RELEASE.md`, entrypoint `deploy-prod`, guard pre-F02/schema/pinned cleanup; fixture synthetic đã dọn. | Không thử SSH/production, không dùng secret thật. |

Harness gọi entrypoint nghiệp vụ backend của hai artifact trong **một** process Node Linux trên PG thật; hai container riêng chứng minh mount/process provenance, chưa boot HTTP API và worker daemon đầy đủ hay thử trên staging/host production. Provider APNs/email là synthetic; `ACCEPTED` không có nghĩa thiết bị nhận. Lease crash được tái tạo ở durable SQL boundary, không kill process thật. Schema range là tuyên bố operator của fixture, reviewer phải đối chiếu migration khi dùng thực tế. Đây là forward recovery schema theo additive migration và app rollback; chưa có migration sửa lỗi sau một migration hỏng. Build logs có Next `BUILD_ID` ngẫu nhiên; không claim reproducibility tuyệt đối.

Lệnh chính: `python3 scripts/release-artifact.py ... build/verify/pin`, rồi `docker run ... node scripts/release-pg-rehearsal.cjs /old /new` với `RELEASE_PG_URL` synthetic trên Docker network cô lập. Log lọc trạng thái tại `/tmp/ar891-t5-pg-rehearsal.log`; manifests ở `/tmp/ar891-t5-pg-rehearsal-releases/<source>-<build>/release-manifest.json`. Fixture PG, container A/B và network của task đã được dọn; không dọn container/volume ngoài task. Full Linux builds chỉ chạy cho hai source SHA trên, còn commit prose/harness sau đó cần revalidate diff và CI, không giả định cùng binary build.
