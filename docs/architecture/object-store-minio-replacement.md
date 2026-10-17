# Object store — thay thế image MinIO (pull bị chặn)

| Trường | Giá trị |
| ------ | ------- |
| Ngày | 2026-10-18 |
| Role | `architect` ([docs/agents/roles/architect.md](../agents/roles/architect.md)) |
| Trạng thái | **Đã chốt O1** (user 2026-10-18) — Decision Log ADR-14 image note cập nhật; compose pin digest |
| Base SHA đã đọc | `5a24f4beece3c2c95ed4ddfa071ba59b3466e1c2` |
| ADR liên quan | ADR-11 (cấm SaaS runtime), ADR-14 (object storage MinIO S3-compatible) |
| Client app | `packages/backend/src/minio.ts` — SigV4 Put/Get + presign PUT; env `MINIO_*` |
| Evidence vận hành | UAT override `cleanstart/minio:latest` OK; prod deploy **bỏ qua** MinIO vì pull deny |
| Pull anonymous (local 2026-10-18) | `cleanstart/minio@sha256:4febd64f…` · `cgr.dev/chainguard/minio@sha256:c93745c5…` · `bitnamilegacy/minio:2024.6.13@sha256:aa175289…` · `pgsty/silo@sha256:aaac6bce…` · `dxflrs/garage` · `chrislusf/seaweedfs` = OK; `minio/mc` + `cleanstart/mc` = **deny** |
| Pull trên VPS | `cleanstart/minio:latest` → **OK** cùng digest `sha256:4febd64f632c221b48e0fbf435ac534df822aa5b06805540c03973939e4cc82a` |

**Non-goals (Task này):** không viết code; không deploy prod; không đổi ADR thành Accepted; không thêm SaaS object store (S3 AWS / R2 / B2 / …); không đổi contract business (quarantine → ready, bucket private, signed URL ngắn hạn).

---

## 1. Phạm vi

### Vấn đề

- Image pin hiện tại: `minio/minio:RELEASE.2025-04-22T22-12-26Z` (`compose.yaml`, `infra/deploy/compose.yaml`); init: `minio/mc:RELEASE.2025-04-16T18-13-26Z`.
- **Docker Hub** đã gỡ anonymous pull `minio/minio` (~Sep 2026); **Quay** `quay.io/minio/minio` khóa ~24 Sep 2026. Local **và** VPS fail cùng kiểu; VPS vẫn pull được `hello-world` → không phải lỗi mạng tổng quát.
- App **không** phụ thuộc binary MinIO SDK: chỉ HTTP SigV4 path-style `/{bucket}/{key}` + health `/minio/health/live` (compose healthcheck / seed scripts).
- UAT (D11 / web22-e2e / `d9-seed-media.sh` / `minio-real.test.cjs`) đã chạy thành công với `cleanstart/minio:latest`.
- Prod: bước `up -d minio minio-init` bị skip → API/worker thiếu store → `MINIO_MISCONFIGURED` / CSV·assets không durable trên VPS.

### Mục tiêu

Chọn hướng **self-host** (ADR-11) giữ **S3-compatible API** đủ cho `ObjectStore` hiện tại, khôi phục local + VPS pull/run, không phá env `MINIO_*` và volume `minio_data` nếu có thể.

### Ngoài phạm vi

- CDN / public bucket; Expo Push / managed DB; redesign key layout `tenants/.../assets/...`.
- Claim capacity PRD từ thay image; pilot-ready / store submission.

### Paths bị ảnh hưởng (handoff sau khi chốt)

| Path | Ownership đề xuất |
| ---- | ----------------- |
| `compose.yaml` (service `minio`) | coordinator |
| `infra/deploy/compose.yaml` (`minio`, `minio-init`) | coordinator |
| `scripts/d9-seed-media.sh`, `packages/backend/test/minio-real.test.cjs` | backend / coordinator (scripts) |
| `docs/ops/ENV-MANIFEST.md`, `infra/deploy/README.md`, `docs/ops/MEDIA-ASSET-CHECKLIST.md` | coordinator |
| `packages/backend/src/minio.ts` | backend — **chỉ nếu** đổi API (path-style / presign / FS adapter) |
| ADR / Decision Log | coordinator sau user/architect chốt |

---

## 2. Ràng buộc

| ID / invariant | Ý nghĩa với quyết định này |
| -------------- | -------------------------- |
| **ADR-11** | Cấm SaaS runtime object store; Postgres/Redis/Keycloak/MinIO/SMTP self-host trên Compose → VPS |
| **ADR-14** | Object storage **S3-compatible self-host**; bucket private; signed URL ngắn hạn do app cấp |
| **Client** | `ObjectStore`: `putObject`, `getObject`, `createPresignedPutUrl`; Node builtins only; region mặc định `us-east-1` |
| **Env** | `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` (hoặc ROOT_*), buckets `MINIO_BUCKET_{ASSETS,EXPORTS,IMPORTS}`, `MINIO_REGION` |
| **Prod path** | Không fallback memory/`createMemoryObjectStore` trên production; thiếu config → fail-closed |
| **Topology** | api + worker cùng endpoint nội bộ (`http://minio:9000`); volume durable `minio_data`; MinIO **không** publish 9000/9001 lên edge |
| **Trust** | Object binary không phải nguồn chuẩn business state (PG + RLS); store chỉ durable blob; authz vẫn app/RLS |
| **Giả định cần xác minh** | (a) Candidate image còn anonymous-pull trên Hub **từ VPS**; (b) SigV4 path-style + presign PUT tương thích; (c) health endpoint hoặc healthcheck thay thế; (d) thay `minio/mc` bằng tool init vẫn tạo được bucket private |

---

## 3. Phương án và đánh đổi

```text
App (api/worker)
  └─ packages/backend/src/minio.ts  (SigV4 Put/Get/presign PUT)
        └─ HTTP(S) → S3-compatible endpoint
              └─ [?] container image / FS adapter
```

### So sánh nhanh

| | **O1 — Đổi image fork/mirror MinIO + thay mc** | **O2 — Store S3 khác (Garage / SeaweedFS / …)** | **O3 — Local FS `ObjectStore` adapter** | **O4 — Tự build/mirror MinIO** |
| - | --------------------------------------------- | ----------------------------------------------- | --------------------------------------- | ------------------------------ |
| Khớp ADR-11/14 | Có (vẫn S3 self-host) | Có nếu self-host S3-compatible | Một phần — mất “object store” thật | Có |
| Đổi app client | Không (kỳ vọng) | Có thể nhỏ (path/virtual-host, checksum) | Có — adapter mới + presign semantics | Không |
| Ops / compose | Đổi `image:` + init | Compose + docs + learning curve | Mount volume vào api/worker | Registry riêng / CI build |
| Rủi ro pull lại | Phụ thuộc vendor mirror (cần pin digest) | Thấp hơn nếu image public ổn định | Không phụ thuộc MinIO image | Thấp sau khi có mirror nội bộ |
| Thời gian khôi phục prod | Ngắn nhất (UAT đã chứng minh cleanstart) | Trung bình–dài | Trung bình; kém phù hợp multi-process | Dài (supply chain + legal) |
| Đảo ngược | Đổi image pin lại nếu upstream mở | Migration object + config | Viết lại sang S3 | Giữ registry |

---

### O1 — Swap image sang fork/mirror MinIO vẫn public + thay `mc`

**Ý tưởng:** Giữ API MinIO / S3 path-style. Đổi pin:

- Server: ví dụ `cleanstart/minio:<tag>` (đã OK UAT), hoặc ứng viên khác sau verify pull: Chainguard `cgr.dev/...`, `bitnamilegacy/minio`, mirror community — **chỉ chọn sau khi `docker pull` từ VPS thành công** và roundtrip SigV4 PASS.
- Init: thay `minio/mc` (cùng bị khóa registry) bằng một trong: (1) script app đã có PutBucket SigV4 (`minio-real.test.cjs` pattern) trong one-shot container/`migrate`-style; (2) `aws` CLI `--endpoint-url` trong image mỏng; (3) `rclone`/`s5cmd` nếu pull được và license OK.

**Ưu:** Blast radius nhỏ; giữ `MINIO_*`, volume layout, health `/minio/health/live` (cleanstart đã dùng); UAT/test đã chứng minh; prod restore nhanh.

**Nhược:** Fork/mirror có thể pin `:latest` (hiện UAT) — **bắt buộc pin digest/tag immutable** trước prod; provenance/CVE theo dõi kém hơn official; healthcheck `curl` trong image có thể thiếu → đổi sang `CMD-SHELL`/`wget`/TCP như note DoD D5; Bitnami/Chainguard có thể khác entrypoint/user (cleanstart UAT dùng `--user root`).

**Điều kiện xem xét lại:** Mọi mirror public anonymous đều bị khóa; hoặc phát hiện fork cắt feature SigV4/presign mà app cần.

---

### O2 — Đổi sang S3 store khác (Garage, SeaweedFS, …)

**Ý tưởng:** Thay process MinIO bằng Garage / SeaweedFS S3 gateway / tương đương self-host; giữ hoặc mỏng hóa `minio.ts` nếu API lệch (virtual-hosted vs path-style, unsigned payload, Region).

**Ưu:** Đa dạng nguồn image; cộng đồng không phụ thuộc một vendor MinIO; một số phù hợp multi-node sau này.

**Nhược:** Chưa có evidence trong repo; cần ma trận tương thích **presign PUT** + path-style; docs/ops/runbook mới; `minio-init` viết lại; rủi ro “gần S3” nhưng fail edge case checksum/header; thời gian dài hơn O1 trong khi prod đang thiếu store.

**Điều kiện chọn:** O1 hết candidate pull được **hoặc** cần topology multi-disk/multi-node rõ ràng vượt MinIO single-node MVP.

---

### O3 — Local filesystem `ObjectStore` adapter

**Ý tưởng:** Implement `ObjectStore` ghi/đọc thư mục host (vd. `/var/vemoki/objects`); `createPresignedPutUrl` trở thành URL app (BFF/api) short-lived thay vì PUT thẳng vào store.

**Ưu:** Không phụ thuộc registry object image; đơn giản local dev; kiểm soát backup bằng volume host.

**Nhược:** **Lệch ADR-14** (không còn S3-compatible self-host như đã chốt); api và worker phải share mount nhất quán; presign PUT browser → object store mất (upload đi qua API → tăng tải/abuse surface); khó mở rộng ngang; prod path hiện fail-closed vì thiếu MinIO — adapter FS dễ bị dùng như “tạm” rồi mắc nợ kiến trúc.

**Điều kiện chọn:** Chỉ spike/dev cực hẹp **hoặc** user chấp nhận sửa ADR-14; **không** khuyến nghị cho VPS MVP hiện tại.

---

### O4 — Tự build / mirror image MinIO

**Ý tưởng:** Build từ source MinIO (hoặc save/load image đã có) → push registry tự host (VPS GHCR private / registry nội bộ) → compose kéo từ đó; tương tự cho `mc`.

**Ưu:** Kiểm soát pin và availability; không phụ thuộc Hub/Quay anonymous; giữ binary/API quen thuộc.

**Nhược:** Chi phí CI/ops; **license AGPL** MinIO — cần hiểu nghĩa vụ phân phối nếu sửa/phân phối binary; rebuild khi CVE; không giải quyết “ai duy trì fork” nếu upstream đổi model phân phối; chậm hơn O1 nếu đã có mirror public tương thích.

**Điều kiện chọn:** Policy bắt buộc binary từ source đã audit; hoặc O1 mirrors biến mất / không tin cậy.

---

## 4. Khuyến nghị

**Chọn O1 (swap image fork/mirror + thay `mc`)** làm phương án mặc định khôi phục ADR-14 trên local và VPS.

Thứ tự thực thi đề xuất:

1. **Pin candidate:** ưu tiên `cleanstart/minio` với **tag/digest cố định** (không để `:latest` trên prod) — đã có evidence UAT/test/seed.
2. **Verify pull trên VPS** trước khi đổi docs “chính thức”: `docker pull <image>@sha256:…`.
3. **Thay `minio-init`:** bỏ `minio/mc`; one-shot tạo bucket private bằng SigV4 PutBucket (tái sử dụng logic test) hoặc CLI S3 mỏng còn pull được.
4. **Healthcheck:** xác nhận `/minio/health/live` trên image đã pin; nếu thiếu `curl`, đổi healthcheck (TCP hoặc binary có sẵn) — không block kiến trúc.
5. **Giữ** `MINIO_*` env và tên volume `minio_data` để giảm churn api/worker.
6. **O2/O4** là lối thoát nếu O1 fail verify; **O3** không dùng cho prod trừ khi sửa ADR có chủ đích.

**Không** đánh dấu ADR-14 thay thế / Accepted trong Task này — chỉ **Đề xuất**. Khi user/coordinator chốt: ghi Decision Log dòng mới (vd. “ADR-14 bổ sung: image không còn `minio/minio` Hub; pin mirror X @ digest …”) hoặc ADR phụ nếu muốn tách “image distribution” khỏi “S3-compatible self-host”.

---

## 5. Handoff ownership

| Việc | Owner | Phụ thuộc thật |
| ---- | ----- | -------------- |
| Chốt O1 (hoặc O2/O4) + digest image | coordinator (+ user nếu đổi ADR wording) | Doc này |
| Đổi `compose.yaml` / `infra/deploy/compose.yaml` image + healthcheck + `minio-init` | **coordinator** | Digest đã pull OK trên VPS |
| Script init bucket (nếu không còn `mc`) | **backend** hoặc coordinator (script root) | Contract PutBucket SigV4 |
| Cập nhật `ENV-MANIFEST` / deploy README / MEDIA checklist (bỏ “chỉ minio/minio”) | **coordinator** | Compose đã merge |
| Giữ nguyên `packages/backend/src/minio.ts` trừ khi verify fail | **backend** | Evidence SigV4 |
| Không đụng `apps/web` / `apps/mobile` | — | Presign URL vẫn HTTP PUT tới endpoint nội bộ qua nginx chỉ khi đã thiết kế public upload; hiện MinIO internal-only |
| ADR / Decision Log cập nhật trạng thái | **coordinator** sau chốt | Không tự Accepted từ architect |
| DoD review exact SHA | `reviewer-dod` | PR compose/docs/backend |

**Architecture impact:** Có — topology image + init path; contract app S3 giữ nguyên nếu O1 thành công.

**Không chặn:** Task web/iOS không phụ thuộc object image; BA/PD.

**Chặn:** Deploy prod bật CSV export / D9 assets / import quarantine trên VPS cho đến khi `minio` (+ init) chạy và api/worker có `MINIO_ENDPOINT`.

---

## 6. Xác minh (evidence cần thu)

| # | Check | Ai chạy | PASS khi |
| - | ----- | ------- | -------- |
| V1 | `docker pull <candidate>@sha256:…` trên **VPS** và máy local | coordinator/ops | Exit 0; không auth Hub bắt buộc |
| V2 | Container `server /data` + health live (hoặc healthcheck mới) | coordinator | Healthy trong compose `--wait` |
| V3 | Roundtrip SigV4: PutObject / GetObject / presign PUT (app client hoặc `minio-real.test.cjs` trỏ image pin) | backend | Test PASS trên SHA triển khai |
| V4 | Init buckets `vemoki-assets` / `vemoki-exports` / `vemoki-imports` private (no anonymous read) | coordinator | `minio-init` one-shot exit 0 |
| V5 | api/worker với `MINIO_ENDPOINT=http://minio:9000` — không `MINIO_MISCONFIGURED`; CSV export READY + download | backend + ops | Log sạch; job READY |
| V6 | `D9_MEDIA_STACK_UP=1 ./scripts/d9-seed-media.sh --smoke-only` (hoặc tương đương) | backend | Smoke GET/HEAD PASS |
| V7 | Xác nhận **không** dùng AWS S3/R2/B2 SaaS | reviewer | Diff compose/env |

**Giới hạn hiện có:** Prod chưa có volume MinIO populated (deploy đã skip) — không cần migration object cũ trên VPS; local volume `minio_data` nếu đã tạo bằng official image thường đọc được bởi fork cùng format (vẫn cần backup trước khi đổi image trên máy có data thật).

---

## 7. Kết luận

| Trường | Giá trị |
| ------ | ------- |
| Verdict | **Đã chốt — O1** |
| Phương án | **O1** — pin mirror/fork MinIO còn anonymous-pull (ưu tiên `cleanstart/minio` đã UAT) + thay `minio/mc` bằng init SigV4/CLI S3 |
| Không chọn mặc định | O3 (FS) cho prod; O2/O4 chỉ khi O1 hết ứng viên hoặc policy bắt buộc |
| ADR | **Không** đánh dấu Accepted trong artifact này; chờ coordinator/user ghi Decision Log |
| Blocker triển khai prod object | Pull deny `minio/minio` + `minio/mc` — hết blocker kỹ thuật sau V1–V5 |
| Người quyết định chốt | Coordinator (trong ủy quyền Epic/deploy) / user nếu sửa wording ADR-14 |
| Người quyết định Reject O1 | User nếu không chấp nhận mirror third-party → chuyển O4 (self-mirror) hoặc O2 |

Hết scope architect docs; implementation thuộc coordinator + backend theo bảng handoff.