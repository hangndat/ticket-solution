# ADR-17 — MVP queue: leased PostgreSQL outbox + direct worker poll

Ngày: 2026-10-17  
Trạng thái: **Đã chốt (MVP kỹ thuật)** — coordinator freeze trong Run `run_2e7fdbc228c6`  
Đối chiếu: [ADR-04](../TECHNICAL-DESIGN.md) (outbox → BullMQ), [DECISION-LOG](../DECISION-LOG.md)

## Quyết định

Giữ **transactional outbox PostgreSQL** đang có (lease / `FOR UPDATE SKIP LOCKED` / `claim_outbox_batch`) làm **durable job queue**, và worker **poll trực tiếp** Postgres. Không triển khai BullMQ enqueue/ack/reconcile trong MVP.

Redis **không** là nguồn chuẩn cho job nghiệp vụ. Vé, notification intent, outbox status sống trên Postgres.

## Đối chiếu ADR-04

| | ADR-04 (TD đề xuất) | ADR-17 (MVP thực tế) |
| --- | --- | --- |
| Durable store | Outbox PG | Outbox PG (giữ) |
| Relay | Claim → enqueue BullMQ → ack | Claim → process cùng worker process |
| Redis role | BullMQ + cache/rate-limit | Cache / admission / rate-limit không quyết định vé |
| Delivery | At-least-once | At-least-once (không hứa exactly-once SMTP/APNs) |
| Moving parts | Redis + BullMQ + reconciler | Ít hơn: PG lease fence + poll |

ADR-04 vẫn mô tả **hướng stack dài hạn** nếu benchmark chứng minh cần fan-out lớn / multi-worker fairness qua queue riêng. MVP **không** tuyên bố “đã làm BullMQ”.

## Lý do

1. Outbox + lease đã có migration/test (`claim_outbox_batch`, reporting/issue tests).
2. Giảm dependency và failure mode (Redis mất dữ liệu không được làm mất job).
3. Worker crash: lease hết hạn → worker khác reclaim (đã trong SQL).
4. Bounded retry / channel fencing / caps thuộc N-BE; root chỉ ghi ngân sách cấu hình và chạy recovery drills.

## Ngân sách concurrency (vận hành kỹ thuật, không SLA)

| Biến / tham số | Mặc định MVP | Ghi chú |
| --- | --- | --- |
| `OUTBOX_POLL_MS` | `2000` | Worker tick |
| Claim `limit` | `10` (SQL max 100) | Một tick / lease owner |
| Lease seconds | `30` (SQL 5–300) | Crash reclaim sau hết hạn |
| Max attempts / channel | `8` (config N-BE) | Exponential 30s→1h ±20% jitter |
| Fairness | Per-tenant caps (platform) | Không mặc định fairness chỉ vì có Redis |

## Điều kiện cân nhắc BullMQ sau này

- Benchmark chứng minh poll PG là bottleneck dưới tải PRD (2×20k) trên hạ tầng đích.
- Nhiều worker process cần fairness/queue isolation mà lease PG không đủ.
- Có yêu cầu cứng sản phẩm/ops chưa phản ánh trong freeze — **báo coordinator trước** khi thêm dependency/lockfile.

## Kiểm chứng root (R-INT)

```bash
./scripts/rint-outbox-recovery.sh   # Redis restart + lease reclaim
node --test scripts/lib/tenant-host.test.mjs
./scripts/rint-stack-smoke.sh       # Compose self-host health (local)
```

Pass recovery **không** chứng minh SMTP outbound internet hay APNs device thật.
