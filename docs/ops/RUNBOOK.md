# Runbook vận hành (MVP / pilot)

Ngày: 2026-10-18 · Issue #25 / #296 · Không thay thế playbook production đầy đủ.

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

### 3.2 Redis / queue (ADR-17 — chưa BullMQ MVP)

- Vé/check-in/outbox phải còn trên Postgres; **Redis không phải durable queue** (ADR-17 bổ sung ADR-04).
- Drill: `./scripts/rint-outbox-recovery.sh` (flush/restart Redis + lease reclaim).
- Admission phụ thuộc Redis: fail closed hoặc chế độ bảo thủ — ghi rõ trước event.
- Gate: không phụ thuộc Redis bắt buộc theo failure matrix TD §15.2.
- Chi tiết env SMTP/MinIO/APNs: [`ENV-MANIFEST.md`](./ENV-MANIFEST.md); ma trận R-INT: [`R-INT-MATRIX.md`](./R-INT-MATRIX.md).

### 3.3 Postgres primary mất

- Dừng issue/confirm; hiển thị unavailable; không nhận thành công giả.
- Không mở lại Gate trên DB restore chưa đối soát (xem restore drill).

### 3.4 Client timeout sau commit

- Retry cùng idempotency-key / tra operation; không tạo giao dịch mới.

### 3.5 TicketIssued email `DEAD` / `TICKET_CREDENTIAL_KEY misconfigured`

Triệu chứng: `notifications.state=DEAD`, `last_error` chứa credential key; worker/api `printenv` key **len 0** dù `/opt/vemoki/.env` có giá trị.

1. Trên VPS: `set -a; . /opt/vemoki/.env; set +a` rồi  
   `cd /opt/vemoki/src/infra/deploy && docker compose --env-file /opt/vemoki/.env up -d --no-deps --force-recreate api worker`.
2. Verify: `docker exec vemoki-worker-1 sh -c 'echo ${#TICKET_CREDENTIAL_KEY}'` → >0 (không in giá trị).
3. Resend vé/email DEAD qua CS (không tự “reopen” DEAD im lặng).
4. Không commit secrets; không `docker compose` recreate api/worker trong shell sạch mà không source `.env` nếu interpolate trống.

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

## 6.1 On-call Gate (O06)

Nguồn số: [`O06-OPTIONS.md`](./O06-OPTIONS.md) §3 · [DECISION-LOG](../DECISION-LOG.md) O06. **Không** claim pilot cửa sổ event khi bảng dưới còn trống người/kênh.

### Cửa sổ vs ngoài cửa sổ

| Ngữ cảnh | Mức hỗ trợ | Phản hồi mục tiêu |
| --- | --- | --- |
| **Ngoài** cửa sổ Gate / opening | Business hours T2–T6 (giờ VN) | Theo severity bên dưới |
| **Trong** cửa sổ Gate / opening | On-call P1 **24/7 theo lịch event** | P1 ≤ **30 phút** |

| Severity | Ví dụ | Ngoài cửa sổ | Trong cửa sổ |
| --- | --- | --- | --- |
| **P1** | Cổng chết / không check-in | BH (xem O06) | ≤ **30 phút** |
| **P2** | Email/redeem lỗi, không chặn cổng | ≤ 4 giờ BH | ≤ 1 giờ |
| **P3** | Cải tiến, copy | ≤ 2 ngày làm việc | ≤ 2 ngày làm việc |

### Kênh

- **Cho phép:** email + chat nội bộ (điền URL/alias thật trước event — không bịa).
- **Cấm:** log OTP / QR plaintext / PII thô vào ticket hỗ trợ.

### Template điền người (điền trước mỗi event — để trống nếu chưa có)

| Vai | Họ tên | Liên hệ | Kênh chính | Ghi chú |
| --- | --- | --- | --- | --- |
| Primary on-call (P1) | Hang Nguyen Dat | hangndat@gmail.com | email | MVP sole operator — trực cửa sổ Gate |
| Secondary / escalation | Hang Nguyen Dat | hangndat@gmail.com | email + phone | Cùng người (MVP); ack miss ≤30m → gọi trực tiếp |
| Owner kỹ thuật (hotfix) | Hang Nguyen Dat | hangndat@gmail.com | email | Hotfix có rollback trong freeze |
| Kênh event-day | — | hangndat@gmail.com | email | Không dùng kênh công khai cho OTP/QR |

Trước claim pilot cửa sổ: xác nhận bảng đã có người thật + kênh reachable; freeze §6 vẫn áp dụng.

## 7. Platform operator bootstrap / recovery (M12)

Policy: [`PLATFORM-POLICY.md`](./PLATFORM-POLICY.md) · Config: `infra/platform/security-config.json`.

### Bootstrap lần đầu (offline, one-time)

1. Enroll TOTP cho account operator trên Keycloak (`ticket-platform-web` — Auth Code + OTP bắt buộc).
2. Lấy access token (audience `ticket-platform-api`, `acr=2`, `auth_time` tươi ≤15 phút).
3. Ghi token vào file `chmod 600` — **không** đưa token/password lên argv hay log.

```bash
./scripts/platform-operator-bootstrap.sh --verify-only --token-file /path/token
./scripts/platform-operator-bootstrap.sh --token-file /path/token
```

4. Script verify JWT rồi gọi module BE (khi đã có). Lần hai phải fail “already bootstrapped” phía BE.
5. **Cấm:** public bootstrap route, env “auto owner by email”, demo account escalation, `SET ROLE` runtime.

### Recovery mất mọi operator

- Chỉ runbook offline explicit + audit (BE); **không** backdoor runtime / permissive escalation.
- Không tự mở lại bootstrap sau khi đã từng thành công trừ thủ tục recovery có kiểm soát.

### DB roles

- `ticket_platform_app` / `ticket_platform_runtime`: NOBYPASSRLS, không inherit `ticket_runtime`, không đọc tickets/PII.
- Xem `infra/deploy/init-db.sh` và `infra/platform/sql/01-platform-roles.sql`.

## 8. Assurance Keycloak

```bash
./scripts/platform-security-config-smoke.sh
./scripts/platform-keycloak-assurance-smoke.sh   # cần Keycloak local
```

Attendee (`ticket-web`) không ép OTP; Owner/admin (`ticket-admin-web`) và platform (`ticket-platform-web`) bind flow OTP.
