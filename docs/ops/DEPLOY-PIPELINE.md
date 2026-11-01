# Quy trình deploy — sơ đồ kỹ thuật

Mô tả luồng deploy theo `scripts/release-remote-build.py` + `scripts/release-artifact.py` (#1104, #1105). Contract chi tiết, rollout schema và xử lý lỗi: [IMMUTABLE-RELEASE.md](./IMMUTABLE-RELEASE.md).

## Tổng quan

```mermaid
flowchart TB
  subgraph DEV["1 · Máy dev — release-remote-build.py --sha SHA"]
    direction LR
    A1["Preflight<br/>prod /v1/health = 200<br/>RAM trống"] --> A2["git push SHA<br/>→ /opt/vemoki/release-git<br/>chỉ object mới"]
    A2 --> A3["Ghi shim docker + run.sh<br/>nice 19 · ionice -c3<br/>--cpus 4 · --memory 5g · label token"]
    A3 --> A4["setsid -f run.sh"]
    A4 --> A5{"Giám sát mỗi 5s<br/>health · RAM · log"}
    A5 -- "health hỏng 2 lần<br/>hoặc RAM < 1500MB" --> A6["Kill container<br/>đúng token"]
  end

  subgraph BUILD["2 · VPS — release-artifact.py build (của chính SHA)"]
    direction TB
    B1["git archive SOURCE_PATHS<br/>→ releases/.build-*<br/>xóa .env*"] --> B2["Kiểm builder<br/>Linux · Node 24 · image ID"]
    B2 --> B3["Digest input từng package<br/>file của package + digest @ticket/* phụ thuộc<br/>+ input chung: file gốc, lockfile, brand/,<br/>image, platform, lệnh build, hash tool"]
    B3 --> B4{"Digest trùng release cũ?<br/>(≤ 3 release mới nhất)"}
    B4 -- có --> B5["cp --reflink output<br/>dist · .next · src/generated<br/>bỏ bước build"]
    B4 -- không --> B6["Nạp .next/cache<br/>release-cache/next-app"]
    B5 --> C1
    B6 --> C1
    C1["Container 1 · có mạng<br/>pnpm install --frozen-lockfile<br/>store + corepack ở pnpm store"] --> C2["Container 2 · --network none<br/>mỗi package: ẩn package không khai báo<br/>→ build → trả lại"]
    C2 --> C3["Ghi buildInputs (digest, output)<br/>lưu .next/cache"]
    C3 --> C4["Strip node_modules/.pnpm<br/>.map · .md · .d.ts (giữ typescript)"]
    C4 --> C5["Smoke native<br/>sharp · Prisma client"]
    C5 --> D1["Inventory SHA256 từng file<br/>(dùng lại digest nếu path/size/mtime trùng)<br/>+ manifest format 2"]
    D1 --> D2["Hardlink file trùng<br/>digest + size + mode với release cũ"]
    D2 --> D3["chmod a-w · rename nguyên tử<br/>→ releases/SHA-buildId"]
    D3 --> D4["Final verify<br/>hash lại toàn bộ cây"]
  end

  subgraph ROLL["3 · Rollout — từng service"]
    direction LR
    E1["migrate (nếu có)<br/>pin --schema DB hiện tại<br/>prisma migrate deploy"] --> E2["pin service<br/>kiểm schema range<br/>→ release-pins.env"]
    E2 --> E3["compose up -d --no-deps<br/>--force-recreate svc"]
    E3 --> E4["Smoke<br/>docker inspect mount · /v1/health<br/>route web/portal · BFF 401"]
    E4 -. lỗi .-> E5["Rollback<br/>pin release cũ + recreate<br/>không rollback DB"]
  end

  A4 --> B1
  D4 --> E1
```

## Dữ liệu trên VPS

```mermaid
flowchart LR
  GIT[("/opt/vemoki/release-git<br/>bare repo")] -->|git archive| STAGE["releases/.build-*<br/>staging"]
  STORE[("~/.cache/vemoki-release/pnpm-store-*<br/>pnpm store + corepack")] -->|mount /pnpm-store| STAGE
  NEXT[("/opt/vemoki/release-cache/next-web, next-portal<br/>.next/cache")] <-->|reflink| STAGE
  OLD[("releases/SHA-buildId (cũ)<br/>read-only")] -->|reflink output<br/>hardlink file trùng| STAGE
  STAGE -->|rename| REL[("releases/SHA-buildId (mới)<br/>read-only + manifest")]
  PINS["/opt/vemoki/release-pins.env"] -->|RELEASE_*_DIR| COMPOSE["Docker Compose<br/>api · worker · web · portal · migrate"]
  REL -->|mount :ro| COMPOSE
  STATEDIR[("/opt/vemoki/state/*<br/>web-data · next cache runtime")] -->|mount rw| COMPOSE
```

| Đường dẫn | Vai trò | Xóa được? |
| --- | --- | --- |
| `/opt/vemoki/release-git` | Bare repo nhận `git push`; nguồn `git archive`. | Có, lần sau push lại đủ. |
| `/opt/vemoki/releases/<SHA>-<buildId>` | Release read-only, manifest checksum từng file, hardlink chung file trùng. | Chỉ qua `cleanup` (chặn release đang pin/mount). |
| `/opt/vemoki/release-cache/next-*` | `.next/cache` web/portal, ngoài release. | Có. |
| `~/.cache/vemoki-release/pnpm-store-<platform>` | pnpm store + `corepack` (pnpm cho bước build không mạng). | Có. |
| `/opt/vemoki/release-pins.env` | Release đang pin cho 5 service. | Không. |
| `/opt/vemoki/release-build/logs` | Log từng lần build. | Có. |
| `/opt/vemoki/state/*` | State ghi được, bind vào release. | Không. |

## Cơ chế chặn ship sai

| Rủi ro | Cơ chế |
| --- | --- |
| Package đọc ngầm package không khai báo | Package ngoài closure dependency bị chuyển sang `.build-hidden/` trong lúc build → đọc ngầm là fail, kể cả build đủ. |
| Build lấy input từ mạng | Bước build chạy `docker run --network none`. |
| Logic tool đổi | Hash `release-artifact.py` nằm trong digest chung → build lại toàn bộ. |
| Gợi ý digest sai | `verify` cuối hash lại toàn bộ cây đã publish. |
| Lệch schema khi pin/rollback | `pin` kiểm range; worker trước F02 bị chặn. |
| Xóa nhầm release | `cleanup` mặc định dry-run; chặn release đang pin hoặc đang mount (kể cả container dừng). |
| Nghi ngờ output tái dùng | `build --full` tắt tái dùng output, cache Next và gợi ý digest. |
| Build làm nghẽn prod | Shim giới hạn CPU/RAM + `nice`/`ionice`; wrapper kill khi health hỏng hoặc RAM thấp. |

## Thời gian (đo trên VPS, mỗi kịch bản 1 mẫu)

| Kịch bản | Trước #1104 | Sau #1104 | Sau #1105 |
| --- | ---: | ---: | ---: |
| Chỉ đổi web | 439s | 136s | 67–72s |
| Chỉ đổi api | 439s | 136s | 60s |
| Build đủ (lockfile hoặc tool đổi, lần đầu sau merge) | 439s | 136s | ~120s |
| Đĩa thêm mỗi release | 1.36 GB | +24 MB | +24–35 MB |

Lần chỉ đổi web (~67s): ssh/push ~3s · kế hoạch ~1s · install ~10s · build web ~15s · strip ~3s · inventory + manifest ~22s · dedupe/publish ~5s · verify ~7s. Manifest là phần lớn nhất còn lại vì `node_modules` cài mới có mtime mới nên phải hash lại.
