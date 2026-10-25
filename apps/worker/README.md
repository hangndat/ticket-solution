# W0 worker

Build `@ticket/backend` first, then `pnpm --filter @ticket/worker dev`.

Nest application context chạy **outbox email relay**, reconcile pending redemptions, account anonymization, MinIO export jobs và (khi cấu hình) dọn import quarantine — poll mặc định 2s (`OUTBOX_POLL_MS`).

## Vận hành

- Cần `DATABASE_URL` và SMTP/MinIO theo slice backend; `TICKET_CREDENTIAL_KEY` (≥16 ký tự) cho relay credential — nếu thiếu/sai, worker log cảnh báo JSON (`credential_key_misconfigured`) và relay có thể đánh dấu job FAILED.
- Ba lịch poll trong cùng process: reconcile, outbox, maintenance (anonymization → export → cleanup). Mỗi job class chỉ có một action đang chạy; một provider/export chậm không giữ lịch reconcile. Tổng số action có thể đang chạy tối đa 5, bằng pool worker 5 connections; mỗi outbox/export claim một row.
- Giới hạn supervisor theo class: reconcile 5s, outbox 20s, anonymization 30s, export 60s, cleanup 30s. `WORKER_TICK_STEP_TIMEOUT_MS` chỉ có thể giảm giới hạn này. Supervisor timeout log `tick_step_timeout`, không tuyên bố I/O đã hủy; action còn chạy khiến tick sau bỏ qua cùng class (`tick_step_still_running`). SMTP và APNs có deadline transport 5s; MinIO có deadline 60s.
- Mỗi 10s worker đọc `worker_due_job_snapshot()` (migration `202610250001_ar891_worker_budget`) và log `queue_snapshot` với due count, oldest due age, reclaim count, p95 duration và pool wait p95. Vượt tuổi budget log `job_due_age_budget_exceeded`. Log và metric chỉ dùng tên class cố định, không ghi tenant/user/ticket/token. `queue_probe_failed` báo thiếu migration/quyền hoặc DB lỗi.
- **Shutdown** (`SIGINT`/`SIGTERM` → Nest hooks): dừng mọi timer, chờ action và probe đang chạy tối đa 30s (`WORKER_SHUTDOWN_TICK_TIMEOUT_MS` nếu set), rồi `$disconnect` khi worker sở hữu DB. Job còn lease được PG reclaim sau restart; SMTP/APNs đã được provider chấp nhận trước DB ack vẫn có thể gửi lặp theo at-least-once.

`node dist/main.js` in banner D4; không Redis queue consumer riêng — PostgreSQL outbox là nguồn sự thật.

## Dev

```bash
pnpm --filter @ticket/worker build
pnpm --filter @ticket/worker test
```
