# Runbook vận hành (MVP / pilot)

Ngày: 2026-10-17 · Issue #25 · Không thay thế playbook production đầy đủ.

## 1. Phạm vi

- Self-host VPS (Docker Compose hoặc tương đương): API, worker, Postgres, Redis, Keycloak, MinIO, SMTP, Caddy/nginx.
- Không Cloudflare Waiting Room; admission theo ADR-15 khi được bật.
- UAT/agent: headless (`scripts/web-uat.sh`, `scripts/sim-uat.sh`) — không điều khiển chuột GUI.

## 2. Health & quan sát

| Tín hiệu | Cách xem | Ý nghĩa |
| --- | --- | --- |
| API liveness | `GET /v1/health` | Process sống; **không** chứng minh DB/OIDC |
| Postgres / Redis exporters | overlay `infra/observability/compose.observability.yaml` | Metric hạ tầng local |
| Prometheus | `:19090` (local overlay) | Scrape config tại `infra/observability/prometheus.yml` |
| App RED/USE metrics | **Gap** — chờ BE `GET /metrics` (Prometheus text) | TECHNICAL-DESIGN §16 |

Alert gợi ý (khi có metric): Gate error tăng, queue age tăng, DB pool wait, outbox pending lâu. Mỗi alert cần bước xử lý bên dưới.

## 3. Sự cố thường gặp

### 3.1 API không bind / 503 identity

1. Kiểm tra `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL`, `DATABASE_URL`.
2. `curl` discovery Keycloak; xác nhận realm `ticket`.
3. Không bypass auth; fail-closed.

### 3.2 Redis / BullMQ lỗi

- Vé/check-in phải còn trên Postgres; outbox giữ việc.
- Admission phụ thuộc Redis: fail closed hoặc chế độ bảo thủ — ghi rõ trước event.
- Gate: không phụ thuộc Redis bắt buộc theo failure matrix TD §15.2.

### 3.3 Postgres primary mất

- Dừng issue/confirm; hiển thị unavailable; không nhận thành công giả.
- Không mở lại Gate trên DB restore chưa đối soát (xem restore drill).

### 3.4 Client timeout sau commit

- Retry cùng idempotency-key / tra operation; không tạo giao dịch mới.

## 4. Backup / restore

```bash
# Fixture tối thiểu (đã có từ PR #45)
./scripts/d5-backup-drill.sh

# Business + key state (Issue #25)
./scripts/d5-business-restore-drill.sh
```

- Pass chỉ chứng minh dump/restore trên Postgres vứt bỏ + invariant business.
- **Không** phải backup production; RPO continuous chưa đo; RTO in artifact là wall-clock local.

Sau restore thật: đóng mutation → đối soát ticket/check-in/quota/credentials.kid → mới quyết định mở cổng.

## 5. Load / admission

```bash
# Cần Keycloak đang chạy (OIDC); harness tự tạo Postgres task-specific
./scripts/d5-load-baseline.sh
# Smoke nhanh:
D5_LOAD_TICKETS_PER_EVENT=500 ./scripts/d5-load-baseline.sh
```

Admission edge (Caddy) chưa deploy — xem `infra/admission/Caddyfile.example`. Không claim S4 opening-shock khi layer vắng.

## 6. Freeze cửa sổ sự kiện

- Không deploy/migration/config rủi ro trong giờ Gate mở, trừ hotfix có chủ sở hữu + rollback.
- Dashboard quá tải: giảm polling/reporting trước khi đụng Gate.
