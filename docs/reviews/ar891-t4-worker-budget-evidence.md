# AR891 F03 — Worker budget evidence (local fixture)

Employee: Monica · Role: backend · Issue: #898 · Source base: `fb2da38e` (PR907 F02 + PR908 quota). Trạng thái: code complete sau khi PR/CI đạt; independent DoD, S3/S6 soak và pilot acceptance do coordinator/reviewer quyết định.

## Quyết định và budget

Giữ **một process**, tách ba lịch trong process: reconcile, outbox, maintenance. Baseline source `fb2da38e` chạy năm bước tuần tự, default supervisor 120s; export treo có thể giữ vòng poll 120s trước lần reconcile kế tiếp. `pnpm --filter @ticket/worker test:worker-budget-baseline` nạp relay gốc từ `git show` với backend dist hiện tại, `WORKER_TEST_HANG_TICK_STEP=relay_exports`, timeout test 100ms: hai lượt local đo vòng đầu 101–103ms; đây là phép đo **scaled synthetic**, không suy ra throughput production. Báo cáo Atlas local `system-design/docs/architecture/atlas-project-review-2026-10-25.md` F03 chỉ nêu rủi ro/đề nghị đo; handoff đã được nhận vào `docs/architecture/ar891-t1-recovery-worker-release-handoff.md`.

| Class                        | p95 / oldest due age mục tiêu T1 | Giới hạn runtime                                           |
| ---------------------------- | -------------------------------- | ---------------------------------------------------------- |
| Reconcile pending redemption | ≤5s / ≤10s                       | batch 50; supervisor 5s; lịch riêng                        |
| Outbox                       | ≤15s / ≤60s                      | claim 1, supervisor 20s, SMTP/APNs transport 5s, lease 30s |
| Account anonymization        | ≤30s / ≤15 phút                  | batch 10, supervisor 30s                                   |
| Export                       | ≤60s / ≤5 phút                   | claim 1, MinIO hard deadline 60s, export lease 120s        |
| Import cleanup               | ≤30s / ≤30 phút                  | batch 20, supervisor 30s                                   |

Một action/class được giữ tới khi promise thật settle, kể cả supervisor đã timeout. Lịch sau bỏ qua class đang chạy nên timeout không sinh overlap vô hạn. Shutdown dừng timer, đợi action có giới hạn; PG lease và F02 fence xử lý reclaim khi restart. Một outbox row/invocation bảo vệ lease 30s; export CSV query có statement timeout 15s và MinIO 60s, dưới lease 120s trong đường bình thường. Nếu process bị kill giữa provider accept và ack, side effect có thể lặp; không khẳng định exactly-once.

Pool worker tối đa **5** connection như trước. Tối đa hai class ưu tiên + ba action maintenance (nếu supervisor timeout rồi chuyển bước), nên upper bound action đồng thời = 5. `createDatabase(..., 5, true)` đo thời gian `pg.Pool.connect` thực tế cho cả callback/promise path; log snapshot báo p95 pool wait. API dùng `createDatabase` mặc định không đổi. Trong local PostgreSQL pool 1 connection, query `pg_sleep(0.08)` cùng query thứ hai tạo pool wait >40ms, test PASS.

## Fault và số đo

| Fixture local                                                                                                 | Kết quả                                                                        | Giới hạn kết luận                                                                  |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Baseline `fb2da38e`, export hang, supervisor scaled 100ms                                                     | First cycle 101–103ms; default source 120000ms                                 | Chứng minh lịch tuần tự bị giữ bởi timeout; không phải phép đo production          |
| Runtime ba lịch, SMTP/APNs action và export action không settle, 25ms scaled timeout, poll 10ms, 115ms window | Reconcile 11 lần; outbox starts 1; export starts 1; shutdown có giới hạn       | Chứng minh isolation/concurrency trong local synthetic, không chứng minh p95 S3/S6 |
| MinIO server local không trả response và trả partial response, deadline fixture 35ms                          | Request bị destroy khoảng 38–40ms cả hai trường hợp                            | Production default 60s; network/MinIO thật cần soak #901                           |
| SMTP server local treo sau greeting, deadline fixture 35ms                                                    | `UNKNOWN` khoảng 38ms, đóng socket; server fixture trả 250 vẫn được `ACCEPTED` | Production default 5s; APNs deadline 5s từ F02 và test recovery                    |
| PG isolated, expired outbox lease                                                                             | `due_count` 1 → 0; `reclaim_count` 0 → 1; token mới khác token cũ              | Snapshot aggregate không trả ID/tenant; F02 fence test giữ nguyên                  |

Runbook: theo dõi `queue_snapshot`, `job_due_age_budget_exceeded`, `tick_step_timeout`, `tick_step_still_running`, `queue_probe_failed`; điều tra class, due count, p95 và reclaim delta. `worker_due_job_snapshot()` là `SECURITY DEFINER`, fixed search path, chỉ trả năm class + aggregate. PUBLIC không có EXECUTE; `ticket_runtime` chỉ có EXECUTE, không SELECT counter table. Migration additive, giữ nguyên chữ ký claim/F02 fence; phải migrate schema trước worker mới. Counter reclaim chỉ tăng khi claim thực sự lấy lease hết hạn, không suy từ attempts/retry.

## Checks và giới hạn còn lại

- `pnpm --filter @ticket/worker test`: 21 PASS, 0 FAIL (local).
- `pnpm --filter @ticket/worker test:worker-budget-baseline`: 101ms first cycle với timeout scaled 100ms.
- `pnpm --filter @ticket/backend test:worker-budget-db`: isolated PG + quyền + outbox reclaim + pool wait PASS.
- `pnpm --filter @ticket/backend test:worker-provider-deadline`: 4 PASS.
- `pnpm --filter @ticket/backend test`: 54 PASS.
- `pnpm --filter @ticket/backend test:architecture-recovery`: 27 PASS, 0 FAIL (F02 fence/APNs, local isolated PG).
- `pnpm --filter @ticket/backend lint`, `pnpm --filter @ticket/worker lint`: PASS.

Chưa có hai lượt mixed-load S3/S6 10 phút và soak #901 trên tài nguyên tương đương production. Chưa khẳng định p95/oldest due age đạt budget trong pilot. Nếu age reconcile/outbox vượt budget >5% mẫu trong 10 phút hai lượt, hoặc pool wait/event-loop lag kéo critical, xem tách process với pool/cpu budget riêng; không thêm broker khi chưa chứng minh PG poll là nút thắt. Infra scrape/alert routing do coordinator sở hữu, worker đã phát log/metric low-cardinality.
