# Runbook — Seed fixture demo lên production (Epic #686)

**Mục tiêu:** 4 org / 6 event (khung giờ khác nhau), staff membership + event assignment, mã redeem, marketing config, media MinIO — **an toàn, idempotent, không đụng dữ liệu vận hành thật**.

**Không chạy theo runbook này** cho đến khi: Epic #686 dod+sec PASS, ADR-21 chốt, owner xác nhận cửa sổ (§9).

**Tài liệu liên quan:** [ADR-21](./ADR-21-PROD-DEMO-SEED.md) · [PROD-SEED-DATASET.md](../demo/PROD-SEED-DATASET.md) (SoT UUID/slug/redeem) · [infra/deploy/README.md](../../infra/deploy/README.md) · [deploy-prod skill](../../.cursor/skills/deploy-prod/SKILL.md) · [MEDIA-ASSET-CHECKLIST.md](./MEDIA-ASSET-CHECKLIST.md) · [D9-DEMO-DATASET.md](../demo/D9-DEMO-DATASET.md) (D9 local only — **không** prod seed) · Issue [#686](https://github.com/hangndat/ticket-solution/issues/686)

**SSH host:** alias `conanphong` (không ghi IP trong repo). Tree: `/opt/vemoki/src`. Env: `/opt/vemoki/.env` (mode 600) — **không** in nội dung file.

---

## 0. Nguyên tắc

| Nguyên tắc | Cách thực hiện |
| --- | --- |
| Idempotent | Chỉ UUID/slug fixture; re-run an toàn (`demo-seed.cjs` JSON report: `codesSkipped`, `membershipsSkipped`, …) |
| Fail-closed | Slug trùng tenant khác UUID → script **throw** (không ghi đè prod thật) |
| Không email spam | Seed **không** tạo `MembershipInvite` outbox; tạm **stop worker** trong window seed |
| Không Keycloak import staff | Staff = email owner thật đã login OIDC; membership grant trong DB |
| HMAC prod | Dùng `CODE_HMAC_PEPPER` hiện có trên VPS — **không** rotate pepper cùng lúc seed |
| MinIO nội bộ | Endpoint Docker network; bucket private; không publish 9000/9001 ra edge |

---

## 1. Phạm vi dữ liệu (Epic #686)

| Hạng mục | Số lượng | Ghi chú |
| --- | ---: | --- |
| Organization (tenant) | 4 | Lục Bảo Live, Saigon Pulse, Di sản Hội An, Mekong Makers — phân bổ event **1 + 2 + 3 + 0** |
| Event PUBLISHED | 6 | Tên production-like — **không** `· Demo` trên UI (xem dataset) |
| Staff | 20 (4×5) plus-address `hangndat+<org>-<role>@gmail.com` | Membership + event assignment theo roster dataset |
| Redeem codes | 10 vé / event | Prefix **`VEM-*`** (không `DEMO-*`), HMAC với prod pepper |
| Media | Logo + banner × 6 event | `brand/prod/manifest.json` + PD sizes |

UUID cố định: namespace **`686f0001-…`** (tách D9 `d9d9f001-*`). Bảng đầy đủ: [`PROD-SEED-DATASET.md`](../demo/PROD-SEED-DATASET.md) — **không** seed trước khi UUID/slug trên `main` khớp code BE.

---

## 2. Điều kiện tiên quyết (verify trước mutate)

Trên VPS, từ `infra/deploy`:

```bash
cd /opt/vemoki/src/infra/deploy
docker compose --env-file /opt/vemoki/.env ps
curl -sf https://api.vemoki.com/v1/health | jq -e '.status == "ok"'
curl -sf https://auth.vemoki.com/realms/ticket/.well-known/openid-configuration | jq -e '.issuer'
```

| Kiểm tra | Pass khi |
| --- | --- |
| `migrate` | Không pending migration (container migrate exit 0 gần nhất) |
| MinIO | `minio` + `minio-init` healthy; api logs **không** `MINIO_MISCONFIGURED` |
| `CODE_HMAC_PEPPER` | Có trong `.env`, độ dài ≥16 (đã dùng prod — không đổi) |
| `OIDC_ISSUER` | `https://auth.vemoki.com/realms/ticket` (khớp discovery) |
| Git trên VPS | Tip `main` chứa commit seed Epic (sau merge BE) |
| `@ticket/backend` build | `dist` có `demo-seed` (xem §5) |

**Staff trước seed:** mỗi email staff (owner plus-address) đăng nhập **một lần** tại `https://app.vemoki.com` để `/v1/me` tạo row `users` với `email_verified=true`. Không tạo user bằng realm JSON.

---

## 3. Backup / snapshot (bắt buộc)

**Owner gate #1** — xác nhận đã backup.

```bash
cd /opt/vemoki/src/infra/deploy
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
docker compose --env-file /opt/vemoki/.env exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-ticket}" -d "${POSTGRES_DB:-ticket}" -Fc \
  > "/opt/vemoki/backups/pre-seed-${STAMP}.dump"
ls -la "/opt/vemoki/backups/pre-seed-${STAMP}.dump"
```

- Tạo thư mục `backups` nếu chưa có; giữ file off-box theo policy owner.
- Ghi **tên file dump + thời điểm + git SHA** (`cd /opt/vemoki/src && git rev-parse HEAD`) vào comment Issue #686.

Tùy chọn: snapshot volume `postgres_data` / `minio_data` ở tầng hypervisor (nếu có) — không thay pg_dump.

---

## 4. Dry-run (không mutate prod — hoặc mutate trên bản sao)

CLI hiện tại **chưa** có `--dry-run`. Dry-run vận hành:

### 4.1 Preflight SQL (read-only)

Chạy trong `psql` / `exec postgres` — **chỉ SELECT**:

```sql
-- Tenant slug trùng fixture nhưng UUID khác → BLOCK seed
SELECT id, slug FROM tenants WHERE slug IN (
  'luc-bao-live', 'saigon-pulse', 'heritage-hoi-an', 'mekong-makers'
);
-- Kỳ vọng: 0 rows HOẶC id thuộc allowlist 686f0001-0001-4000-8000-00000000000%

-- Event slug fixture (6 event — org4 không có event)
SELECT id, slug FROM events WHERE slug IN (
  'dem-am-indie', 'pulse-afterhours', 'pulse-rooftop',
  'pho-co-dem', 'song-thu-workshop', 'festival-an-song'
);
-- Kỳ vọng: 0 rows HOẶC id thuộc allowlist 686f0001-0002-4000-8000-00000000000%

-- Tenant production không thuộc fixture (thông tin)
SELECT count(*) AS prod_tenant_count FROM tenants
WHERE id::text NOT LIKE '686f0001-%';
```

Nếu slug fixture đã gắn UUID lạ → **dừng**, không seed.

### 4.2 Dry-run trên bản restore

1. Restore dump §3 vào DB tạm (local hoặc container postgres thứ hai) **hoặc** chạy full seed trên staging VPS.
2. Chạy §5–§6 trên môi trường **không** prod.
3. Lưu JSON output `demo-seed.cjs` + media smoke làm evidence.

### 4.3 Dry-run logic (sau BE)

Theo dõi handoff ADR-21: `PROD_SEED_DRY_RUN=1` — in report, rollback transaction (khi implement).

---

## 5. Seed database (container `api`)

**Owner gate #2** — cửa sổ bảo trì ngắn; chấp nhận stop worker.

```bash
cd /opt/vemoki/src/infra/deploy

# Giảm rủi ro outbox/SMTP trong lúc seed
docker compose --env-file /opt/vemoki/.env stop worker

# Đảm bảo backend đã build (sau rsync/deploy api)
docker compose --env-file /opt/vemoki/.env exec -T api \
  sh -c 'test -f packages/backend/dist/index.js && test -f packages/backend/scripts/demo-seed.cjs'

docker compose --env-file /opt/vemoki/.env exec -T api \
  node packages/backend/scripts/demo-seed.cjs \
  | tee "/opt/vemoki/backups/seed-report-${STAMP}.json"
```

Biến môi trường (đọc từ compose / `.env` trong container — **không** paste pepper vào chat):

| Biến | Prod |
| --- | --- |
| `DATABASE_URL` | Có (compose api) |
| `CODE_HMAC_PEPPER` | Prod pepper hiện hữu |
| `OIDC_ISSUER` | `https://auth.vemoki.com/realms/ticket` |
| `D9_DEMO_FORCE_MARKETING` | Chỉ `1` khi cập nhật copy marketing sau lần seed đầu |
| `D9_DEMO_STAFF_SUBJECT` / `PROD_SEED_STAFF_EMAIL` | **Sau BE Epic** — subject/email owner; prod **không** dùng `staff@example.com` |

**Kỳ vọng lần 2:** `codesInserted: 0`, phần lớn `*Skipped` tăng — không lỗi.

```bash
docker compose --env-file /opt/vemoki/.env start worker
```

Smoke (từ host có network tới api, hoặc exec api):

```bash
cd /opt/vemoki/src
OIDC_ISSUER=https://auth.vemoki.com/realms/ticket \
  API_BASE=https://api.vemoki.com \
  ./scripts/d9-demo-seed-smoke.sh
```

Điều chỉnh script/env theo credential staff prod (không commit password).

---

## 6. Seed media MinIO (nội bộ)

Theo [`MEDIA-ASSET-CHECKLIST.md`](./MEDIA-ASSET-CHECKLIST.md). **Không** `D9_MEDIA_STACK_UP` trên prod (không bring-up compose local).

```bash
cd /opt/vemoki/src/infra/deploy

# Endpoint nội bộ — ví dụ tên service compose (khớp .env MINIO_ENDPOINT)
docker compose --env-file /opt/vemoki/.env exec -T api \
  sh -c 'node scripts/d9-seed-media.mjs --json' \
  | tee "/opt/vemoki/backups/media-seed-${STAMP}.json"

# Chỉ kiểm tra object đã có (sau put)
docker compose --env-file /opt/vemoki/.env exec -T api \
  node scripts/d9-seed-media.mjs --smoke-only
```

- Credentials: `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET_ASSETS` từ `.env`.
- Object key: `tenants/{tenantId}/events/{eventId}/assets/ready/...` — khớp manifest.
- **Không** mở cổng MinIO ra internet; app dùng signed URL.

Sau PD Epic #686: cập nhật `brand/prod/manifest.json` (UUID `686f0001-*`) trước khi chạy prod.

---

## 7. Tránh email / notification ngoài ý muốn

| Rủi ro | Mitigation |
| --- | --- |
| `MembershipInvite` SMTP | **Không** gọi API invite trong phiên seed; ADR-21 chọn grant DB |
| Outbox cũ PENDING | Stop worker §5; sau seed start worker; kiểm tra `outbox` nếu nghi ngờ |
| `TicketIssued` | Seed không phát hành vé attendee qua outbox |
| SMTP prod (ADR-13) | Mailpit **không** phải prod; khi đã bật SMTP thật, cấm test invite hàng loạt |

Worker prod hiện có thể vẫn trỏ Mailpit (`infra/deploy/README.md`) — vẫn **không** tạo invite trong seed để tránh noise và phụ thuộc delivery.

---

## 8. Rollback

**Owner gate #3** — chọn một đường trước khi thao tác.

### 8.1 Khôi phục full (khuyến nghị nếu nghi ngờ)

```bash
cd /opt/vemoki/src/infra/deploy
docker compose --env-file /opt/vemoki/.env stop api worker
docker compose --env-file /opt/vemoki/.env exec -T postgres \
  pg_restore -U "${POSTGRES_USER:-ticket}" -d "${POSTGRES_DB:-ticket}" --clean --if-exists \
  < "/opt/vemoki/backups/pre-seed-${STAMP}.dump"
docker compose --env-file /opt/vemoki/.env start api worker
```

Xác minh health + không còn tenant fixture nếu restore về trạng thái pre-seed.

### 8.2 Surgical (chỉ khi chắc phạm vi fixture)

Xóa theo **UUID allowlist** `686f0001-…` (thứ tự: assignment → membership → codes → event → tenant) — viết script BE/review trước khi dùng prod. **Cấm** `DELETE FROM tenants` không điều kiện.

MinIO: xóa keys trong manifest (aws-cli trong network nội bộ hoặc mc) — không xóa cả bucket.

### 8.3 Forward fix

Re-run seed idempotent sau sửa dataset — chỉ khi preflight §4.1 PASS.

---

## 9. Owner confirmation gates (bắt buộc)

| # | Gate | Ai |
| --- | --- | --- |
| 1 | Backup dump tồn tại + SHA ghi nhận | Owner |
| 2 | Cửa sổ chạy seed + stop worker chấp nhận | Owner |
| 3 | Dataset UUID/slug khớp code trên `main` tip deploy | Owner + coordinator |
| 4 | Staff email plus-address đã login OIDC ít nhất một lần | Owner |
| 5 | `CODE_HMAC_PEPPER` không đổi trong window | Owner |
| 6 | Preflight SQL §4.1 không BLOCK | Operator |
| 7 | dod+sec Epic #686 PASS trên SHA deploy | Coordinator |
| 8 | Rollback plan đã chọn (§8.1 vs §8.2) | Owner |
| 9 | **Lệnh seed prod thực thi** | Owner explicit (sau 1–8) |
| 10 | Smoke + media PASS; không email lạ | Owner |

---

## 10. Checklist sau seed

- [ ] `seed-report-*.json`: `ok: true`, fixture UUID đúng số lượng tenant/event
- [ ] `d9-demo-seed-smoke.sh` hoặc UAT tương đương PASS trên prod
- [ ] `d9-seed-media.mjs --smoke-only` PASS
- [ ] Web/iOS: catalog hiển thị 6 event demo, media không vỡ layout (task Web/iOS Epic)
- [ ] Không tenant/event prod bị đổi slug/name ngoài UUID fixture
- [ ] Comment Issue #686: dump path, git SHA, JSON paths, thời gian UTC

---

## 11. Việc **không** làm

- Chạy seed từ máy dev qua `DATABASE_URL` prod công khai
- Import `staff@example.com` / password demo vào Keycloak prod
- Bulk MembershipInvite khi SMTP có thể gửi ra internet
- Publish MinIO ra edge
- Đổi `CODE_HMAC_PEPPER` để “test” seed
- Merge runbook PR này = **không** tự động được phép chạy prod (chỉ tài liệu)

---

## 12. Handoff implementation (wave sau)

| Task | Mô tả |
| --- | --- |
| BE | Mở rộng `demo-seed.ts` 4/6; `PROD_SEED_STAFF_EMAIL`; optional `PROD_SEED_DRY_RUN` |
| PD/Web | Manifest + asset sizes 6 event |
| iOS | Verify demo catalog |
| Ops | Thực thi runbook sau gate §9 |

Architecture artifact: [`docs/architecture/epic-686-prod-seed.md`](../architecture/epic-686-prod-seed.md).
