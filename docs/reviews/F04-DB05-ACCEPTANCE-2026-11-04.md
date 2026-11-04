# F04 DB-05 — bằng chứng lớp D

Issue #1030; chỉ DB-05, không đóng toàn domain. Architecture impact: Không.
Tested SHA: `e9cbdb34488cc8478069390f03478239baa10fe4`.
Run record: `db05-ctx-1e71c5ca317e`, gắn dispatch thực `ctx_1e71c5ca317e` của Gonic.
Đây là ID bản ghi do coordinator gắn sau thực thi; runner backend không phát native run ID.

Lệnh: `pnpm test:integration:local --case DB-05 --suite D`.
Kết quả trên PostgreSQL thật: 3 selector, **4 PASS / 0 FAIL / 0 SKIP**, exit 0.
PLAN §6.1 yêu cầu DB-05 lớp D; không có thay đổi production hoặc test trong PR này.

| Selector | Phạm vi được chạy |
| --- | --- |
| `issue.test.cjs` — `issue: last-seat` | Tranh suất cuối, idempotency và quota nhất quán |
| `approval.test.cjs` — `F01: mixed auto/manual` | Tranh chấp AUTO/MANUAL qua 5 event, 20 calls/vòng, 0 unexpected errors |
| `db04-db05-acceptance.test.cjs` — `DB-05:` | Từng quota event/type/source hữu hạn khi các scope khác nullable; rollback code, operation và side effects sau mutation quota |

Gonic đã đối chiếu finite/null quota, allocated bounds và rollback snapshot trong test hiện hành.
Review acceptance cần xác minh độc lập assertions tại tested SHA; bản ghi này chưa phải verdict reviewer.

Provenance được thu từ transcript Orca: trước lệnh `git status --short` rỗng;
sau lệnh, `git status --short && git rev-parse HEAD && date -u +%Y%m%dT%H%M%SZ`
chỉ trả SHA trên và `20261104T070902Z`. Không có tracked diff trong lượt chạy.
Dependency được cài bằng `pnpm install --frozen-lockfile`; TypeScript 5.9.3.

Bản ghi private ở `.orca-metrics/db05-ctx-1e71c5ca317e/`: `transcript-tail-full.json`,
`provenance.json`, `result-mail.json`, `worker-result.txt`, `SHA256SUMS`.
Transcript tool-result bị Orca cắt; `worker-result.txt` lưu nguyên báo cáo worker chứa output test đầy đủ.
Đây là evidence lưu sau chạy, không phải manifest sinh tại thời điểm bắt đầu; reviewer cần xét giới hạn này.
Không commit transcript/fixture/credential. Cảnh báo tombstone keyring synthetic xuất hiện;
không làm test fail và không chứng minh account-deletion AC. Không suy ra pilot-ready hay AC khác.
