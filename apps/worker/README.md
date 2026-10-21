# W0 worker

Build `@ticket/backend` first, then `pnpm --filter @ticket/worker dev`.

Nest application context chạy **outbox email relay**, reconcile pending redemptions, account anonymization, MinIO export jobs và (khi cấu hình) dọn import quarantine — poll mặc định 2s (`OUTBOX_POLL_MS`).

## Vận hành

- Cần `DATABASE_URL` và SMTP/MinIO theo slice backend; `TICKET_CREDENTIAL_KEY` (≥16 ký tự) cho relay credential — nếu thiếu/sai, worker log cảnh báo JSON (`credential_key_misconfigured`) và relay có thể đánh dấu job FAILED.
- Lỗi từng bước trong poll cycle được log JSON (`tick_step_failed`, không PII); bước treo quá giới hạn log `tick_step_timeout` (mặc định 120s, `WORKER_TICK_STEP_TIMEOUT_MS`; giá trị env ≤0 hoặc không hợp lệ → 120s) rồi **tiếp tục** bước sau — timeout không coi bước đã hoàn tất. Promise nền vẫn chạy: tick kế **bỏ qua** cùng bước nếu còn in-flight (`tick_step_still_running`), không chồng hai lần cùng bước.
- Đếm lỗi liên tiếp reset khi một cycle hoàn tất không lỗi/timeout.
- Poll **không tái nhập**: interval chồng lên tick đang chạy sẽ bỏ qua (`tick_skipped`).
- **Shutdown** (`SIGINT`/`SIGTERM` → Nest hooks): dừng interval, chờ tick đang chạy tối đa 30s (`WORKER_SHUTDOWN_TICK_TIMEOUT_MS` nếu set), rồi `$disconnect` khi worker sở hữu DB.

`node dist/main.js` in banner D4; không Redis queue consumer riêng — PostgreSQL outbox là nguồn sự thật.

## Dev

```bash
pnpm --filter @ticket/worker build
pnpm --filter @ticket/worker test
```
