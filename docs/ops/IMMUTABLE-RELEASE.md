# Release bất biến cho VPS — #899

**Trạng thái:** quy trình và fixture local; chưa chạy trên production/staging. Chỉ operator có ủy quyền production riêng mới chạy lệnh Compose trên VPS. Không đọc hoặc đưa `.env`, APNs `.p8`, realm secrets, signing keys vào release/log/manifest. `/opt/vemoki/state` và `/opt/vemoki/secrets` nằm ngoài release. Không chạm iOS/store/cloud.

## Layout và contract

`/opt/vemoki/releases/<source-SHA>-<build-ID>/` là tree read-only, build trong `.build-*` trên cùng filesystem rồi `rename` nguyên thư mục. `release-manifest.json` ghi SHA nguồn, build ID, SHA256 lockfile, Linux/Node ABI + image ID, từng file checksum, artifact digest từng service (`api`, `worker`, `web`, `portal`, `migrate`), schema `min/max`, và cờ worker F02. API và worker cùng chứa dependency backend trong **mỗi release**; mỗi container chỉ mount release được pin cho chính nó. Artifact có sẵn thư mục rỗng `.data` và `.next/cache` để bind writable state bên ngoài vào đúng target dưới mount read-only. Runtime kiểm provenance bằng `docker inspect` mount source + manifest và `scripts/release-artifact.py verify`. Pin file nằm ngoài git; mỗi dòng là một Compose interpolation variable. Không dùng symlink `current`.

Schema range là tuyên bố tương thích của release, **operator phải đối chiếu migration và kết quả test** trước khi nhập `--schema-min/max`; tool không thể tự suy ra backward compatibility từ SQL. Số schema là số hiệu rollout do operator ghi trong release plan, không phải version tenant config. Release cũ/new đồng tồn chỉ khi cả hai hỗ trợ schema hiện hành và outbox semantics. F02 worker cũ trước commit `710b5714` bị chặn pin.

## Build và kiểm tra trên Linux cùng architecture VPS

Ví dụ dưới đây chỉ là lệnh chuẩn bị, **không phải lệnh được phép chạy production trong task này**. Dùng checkout sạch tại exact SHA đã review. Trên builder Linux Node24 cùng architecture runtime (ví dụ VPS x86_64):

```sh
docker build --platform linux/amd64 -f infra/deploy/Dockerfile.runtime -t vemoki-runtime:local infra/deploy
python3 scripts/release-artifact.py --root /opt/vemoki/releases build --sha <FULL_SHA> --platform linux/amd64 --schema-min <MIN> --schema-max <MAX>
python3 scripts/release-artifact.py --root /opt/vemoki/releases verify <SHA-BUILD_ID>
```

Build dùng `git archive` của SHA với allowlist chỉ gồm app, workspace dependencies, brand và root build config; loại `.env*` ngay trong staging. pnpm frozen lockfile build contracts/backend/ui/web-session và cả bốn app **trong staging**, không đọc `.env` thật. `pnpm generate` tạo Prisma client trên Linux. Image Node version và arch được kiểm trước build; native `sharp`/Prisma phải qua smoke ở đúng architecture trước deploy. Build ID là hash của tree; Next 16 sinh BUILD_ID ngẫu nhiên nên hai build cùng SHA có thể ra ID khác, nhưng mỗi release vẫn được pin/checksum riêng. Không tự nhận bit-for-bit reproducibility. Không copy `node_modules` build trên macOS sang Linux. Workspace symlink thoát tree làm verify fail.

## Expand, rollout, rollback

1. Backup theo runbook hiện hành; đo schema hiện hành từ `_prisma_migrations`, kiểm migration mới chỉ **expand** (column nullable/default tương thích, index additive). Backfill theo tenant/batch idempotent; kiểm old/new API đọc/ghi và canary outbox. Không contract khi binary cũ còn chạy hoặc mobile compatibility window chưa hết.
2. Tạo `/opt/vemoki/state/web-data`, `/opt/vemoki/state/web-next-cache`, `/opt/vemoki/state/portal-next-cache` với quyền chỉ runtime ghi; giữ `.env` và APNs key ở path ngoài release. **Cutover đầu tiên:** trước bất kỳ lệnh Compose nào với file mới, pin cả năm service (`api`, `worker`, `web`, `portal`, `migrate`) vào release đã verify bằng năm lần gọi `pin`, với schema hiện hành; những container còn chạy theo Compose cũ không đổi mount cho đến khi recreate riêng. Các lần sau copy pin file hiện hành ra backup an toàn rồi chỉ đổi service cần rollout. Với `migrate`, pin release mới rồi chạy một lần, đợi exit 0. Nếu migration fail, **dừng rollout**; không restore/down migration tự động.
3. Pin đúng một service bằng tool, ví dụ `python3 scripts/release-artifact.py --root /opt/vemoki/releases pin <SHA-BUILD_ID> api --schema <CURRENT> --pins /opt/vemoki/release-pins.env`. Compose dùng **cả** `--env-file /opt/vemoki/.env --env-file /opt/vemoki/release-pins.env`; chạy `config --quiet` rồi `up -d --no-deps --force-recreate api`. Đối chiếu `docker inspect <container> --format '{{json .Mounts}}'` với pin và `verify` release. Test `/v1/health`; với web/portal test HTTP route và BFF 401 không session; worker test start/outbox trên fixture. Mỗi lần chỉ thay một pin, các container khác vẫn mount tree cũ.
4. Worker rollout chỉ sau expand + repair legacy rows. Nếu old worker không hiểu state mới, dừng claim, đợi lease hết và xác nhận fence trước khi bật new worker; không chạy đồng thời hai worker lệch semantics trên cùng outbox.
5. Rollback app: `pin` release cũ với schema **hiện hành**, rồi `up -d --no-deps --force-recreate <service>` và smoke. Tool chặn schema ngoài range hoặc worker trước F02. **Không** rollback database destructive. Nếu range không cho phép, forward recovery bằng release sửa mới và repair job, giữ backup để điều tra. Chỉ contract sau khi mọi consumer cũ rời rollout.

## Lỗi theo bước và cleanup

| Bước lỗi | Xử lý |
| --- | --- |
| Git archive/install/build/native ABI | Bỏ staging `.build-*` sau khi kiểm không còn process build; pin và last-good release không đổi. |
| Verify/checksum/symlink | Không pin; điều tra artifact, build lại từ SHA sạch. Không sửa release read-only tại chỗ. |
| Migration expand/backfill | Dừng rollout, giữ app cũ nếu còn tương thích; sửa migration tiến tới hoặc backfill idempotent. Không chạy down/restore production. |
| Pin/Compose config/recreate/health | Pin lại release cũ nếu schema cho phép, recreate đúng service, so `docker inspect` mount và health. Nếu không tương thích, forward recovery. |
| Worker reclaim/pending push | Không dùng worker pre-F02; kiểm fence/lease và provider state trước khi bật claim. Không đánh dấu COMPLETE cho pending push. |
| Cleanup | Giữ rollback window theo release plan. `cleanup` mặc định dry-run, chặn pin và mọi live Docker mount; `--execute` chỉ sau khi inspect Docker thành công. Không xóa path ngoài release root. |

```sh
python3 scripts/release-artifact.py --root /opt/vemoki/releases cleanup <SHA-BUILD_ID> --pins /opt/vemoki/release-pins.env
# Sau khi đối chiếu window, pins và docker inspect: thêm --execute.
```

Local fixture: `python3 scripts/release-artifact.test.py`. Test bao gồm hai release tồn tại đồng thời, pin API mới không thay worker cũ, rollback API trên schema expand, chặn rollback incompatibility/pre-F02 worker, checksum tamper và SQLite expand/backfill/old-new read/forward repair. [Rehearsal PostgreSQL #899](./AR891-T5-PG-REHEARSAL.md) bổ sung migration thật giữa hai source SHA hậu F02, issue/reclaim/notification qua backend artifacts Linux, pin/mount process độc lập, app rollback và negative schema gate. Đây vẫn là môi trường local synthetic; staging smoke và reviewer độc lập cần theo gate rollout thực tế.
