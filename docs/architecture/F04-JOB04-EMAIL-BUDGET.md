# JOB-04 · Contract ngân sách email tenant — đề xuất cho coordinator

**Trạng thái:** Đề xuất thiết kế, chưa được chấp nhận; không có code/runtime/test trong dispatch này. **Issue:** #1032, `tests/e2e/PLAN.md:233` (JOB-04 D/H), liên hệ JOB-06 `:235` chỉ ở invariant tenant cap. **Employee/role:** Dexter / `architect`. **Source đã đọc:** checkout `/Users/admin/SideProject/ticket-solution/f04-job04-resend` HEAD `a1452af30f61a5aac99887105564bdac083483f2` (sạch lúc đọc); PRD, TECHNICAL-DESIGN, DECISION-LOG và PLAN ở `main-3` (working tree dirty, chỉ đọc). Không diễn giải artifact này là kết quả kiểm thử trên SHA.

## Quyết định đề xuất

Đặt **admission ngân sách hàng ngày tại worker, ngay trước từng lần gọi SMTP**, dùng PostgreSQL làm nguồn chuẩn. Một lần gọi SMTP được cấp **một slot duy nhất** trước I/O; `ACCEPTED` chuyển slot đó thành `sent_count`, `UNKNOWN` giữ slot để không cấp vượt mức khi relay có thể đã nhận thư, và chỉ lỗi **chắc chắn trước accept** mới trả slot. Retry/replay cần slot mới vì đó là một lần gọi SMTP mới. Không tính ngân sách khi API tạo command/outbox; không tự tạo tenant hourly cap từ `email_per_day`.

Điểm giới hạn không thể loại bỏ: PostgreSQL và SMTP không chung transaction. Sau accept nhưng trước ack, có thể gửi lặp theo ADR-17/JOB-03; `Message-ID` không phải bằng chứng relay dedup. Contract này bảo vệ **số SMTP attempts được admission theo ngày** (kể cả kết quả mơ hồ), không hứa chính xác số thư tới inbox hoặc exactly-once SMTP.

## Dữ kiện, ranh giới và gap source

| Loại | Bằng chứng và ý nghĩa |
| --- | --- |
| Đã chốt | PRD `:203-213`: resend có cooldown, tenant cap, user limit; provider accept khác delivered. TECHNICAL-DESIGN `:12-14,:203-217`; DECISION-LOG `:196-202`: PG SoT, outbox leased PG/direct poll, SMTP self-host, at-least-once. PLAN `:232-235`: JOB-03 cho phép duplicate SMTP, JOB-04 D/H cần cap/dedup/status đúng; JOB-06 kiểm tenant cap khi overlap. |
| Schema hiện hữu | `packages/backend/prisma/migrations/202610170012_d4_platform_m01/migration.sql:26-42,164-169,193-194,244-249`: `tenant_limits.email_per_day` nullable/nonnegative; `tenant_email_usage(tenant_id,usage_date,sent_count)` PK theo ngày, RLS. `packages/backend/src/tenant-registration.ts:9-15`: self-serve mặc định 100/ngày. `packages/backend/src/tenant-limits-usage.ts:20-75` và migration `:526-553` đọc `sent_count` của UTC day; tìm trong `packages/backend/{src,prisma/migrations}` chỉ thấy write qua fixture/test, chưa thấy SMTP path tăng `sent_count`. |
| Luồng hiện hữu | `packages/backend/src/outbox.ts:93-159,183-270,286-329,568-699`: worker xử lý MembershipInvite, InvitationReady, TicketIssued; SMTP I/O ngoài tenant transaction, ack sau I/O. `:1235-1287` fence outbox theo lease token. `packages/backend/src/email-adapter.ts:140-253`: ba đường SMTP. `packages/backend/src/smtp-send.ts:91-185`: timeout/socket trả `unknown`; `:190-212` biến UNKNOWN của plain mail thành exception. `:162-163` trả `accepted: accepted || true`, vì vậy flag `accepted` hiện không phân loại reject. |
| Resend hiện hữu | `packages/backend/src/cs.ts:401-575` giữ 60s/ticket và 10/h/staff qua audit, tạo outbox + notification business key riêng; lock ticket bảo vệ same-ticket nhưng count staff qua nhiều ticket không atomic. `packages/backend/src/notification-retry.ts:131-178` có `tenantCapPerHour?`, song API `apps/api/src/notifications.ts:158-174` không truyền; `notification-service.ts:113-232` requeue. Đây là cap hourly tùy chọn, **không phải** `email_per_day`. `outbox.ts:1134-1144` dùng hardcoded issued business key ở failure path, có thể không chọn notification của CS resend có business key `ticket:<id>:resend:email:<operation>` (`cs.ts:518-565`). Cần đối chiếu/fix trong scope JOB-04, không suy là runtime đã pass. |
| Trạng thái | `notification-status.ts:1-25`: ACCEPTED = provider nhận. `N1` migration `:39-71` có attempt ordinal cho notification email/push; invite outbox chưa có `notifications` row. Không được ghép ba luồng vào riêng bảng `notification_attempts`. |

## So sánh phương án

| Phương án | Điểm được | Giá phải trả / kết luận |
| --- | --- | --- |
| A. Trừ `sent_count` khi API enqueue; retry dùng cùng debit | Đơn giản, reject cap ngay tại HTTP. | Đếm thư chưa gửi, ticket issue/approval có thể bị quota chặn hoặc báo quota giả; refund khó khi crash; một outbox retry có thể SMTP ACCEPTED nhiều lần nhưng chỉ tính một. **Không chọn.** |
| B. Worker cấp slot cho **mỗi SMTP invocation**, ledger + counter trên PG, settle ACCEPTED/UNKNOWN/RELEASED | Bao mọi đường email, serialize concurrent admissions, có chứng cứ recovery; giữ `sent_count` là accepted đã xác nhận. | Thêm một bảng + một cột held, UNKNOWN có thể giữ cap lâu; quota exhausted trì hoãn email. **Đề xuất.** |
| C. Chỉ `sent_count++` sau SMTP ACCEPTED, conditional `sent_count < limit` | Ít schema. | Các worker đọc cùng số rồi cùng gửi trước khi counter tăng; không thể thu hồi accept vượt cap, đặc biệt crash/UNKNOWN. **Không chọn.** |

## Hợp đồng DB và chuyển trạng thái

**Migration đề xuất** (không thực thi ở đây): thêm `held_count integer NOT NULL DEFAULT 0 CHECK >=0` vào `tenant_email_usage`; `CHECK sent_count >=0`. Tạo `tenant_email_budget_attempts` chứa `tenant_id`, `attempt_id UUID`, `outbox_id`, `lease_token`, `usage_date DATE`, `state` (`HELD|ACCEPTED|UNKNOWN|RELEASED`), `provider_ref` nullable, timestamp; PK `(tenant_id,attempt_id)`, UNIQUE `(tenant_id,outbox_id,lease_token)` và index `(tenant_id,usage_date,state)`. RLS tenant-local giống bảng usage; runtime chỉ có quyền cần thiết; không lưu địa chỉ email/token trong ledger. `attempt_id` là identity của **SMTP invocation**, không phải logical notification. Với cùng lease token chỉ được vào I/O một lần; reclaim cấp token mới. Nếu migration không có cách chứng minh producer ngoài `outbox`, bắt buộc mọi SMTP send hiện hành đi qua wrapper relay có slot; không để adapter công khai tạo đường bypass production.

**Invariant:** với tenant có limit `L >= 0`, tại mọi commit `sent_count + held_count <= L` cho từng `usage_date`. Mỗi attempt nằm đúng một trạng thái: HELD/UNKNOWN góp `held_count`; ACCEPTED góp `sent_count`; RELEASED góp 0. Vì vậy **không đếm cùng attempt hai lần**. `sent_count` chỉ tăng khi relay xác nhận ACCEPTED, không tăng khi nhận command, queue, SMTP timeout hay event delivered/bounced. `NULL` nghĩa không giới hạn admission nhưng vẫn ghi accepted usage; `0` nghĩa không cấp slot; thiếu `tenant_limits` row là lỗi cấu hình fail-closed, không diễn giải thành unlimited.

**Admission transaction** dưới `withTenant`: lock `tenant_limits` row `FOR SHARE` để serialize operator đổi limit; lấy một DB clock `clock_timestamp()` và UTC date; upsert `tenant_email_usage` row; conditional `UPDATE ... SET held_count = held_count + 1 WHERE email_per_day IS NULL OR sent_count + held_count < email_per_day` dưới row lock; insert ledger HELD cùng transaction. Duplicate `(outbox,lease_token)` trả attempt cũ **không tự gọi SMTP lại**. Nếu tenant limit bị hạ dưới mức đã chiếm, giữ dữ liệu/history, chặn admission mới cho tới khi tổng dưới limit; không trừ ngược. Không giữ DB transaction/lock qua SMTP I/O.

**Settle transaction** độc lập outbox ack: theo `attempt_id` và tenant, row lock ledger + usage, CAS state. `HELD/UNKNOWN → ACCEPTED`: `held_count--`, `sent_count++`, lưu provider ref; lập lại là no-op. `HELD → UNKNOWN`: giữ held; `HELD → RELEASED`: `held_count--` **chỉ khi** transport chứng minh chưa được relay accept (vd. reject trước DATA). Lỗi ứng dụng, timeout, socket reset và crash sau khi bắt đầu send đều UNKNOWN/conservative nếu không có chứng cứ no-accept; adapter hiện tại cần kết quả typed rõ, không dùng `catch` chung để refund. Ack notification/outbox vẫn fenced theo lease; **budget settlement không phụ thuộc lease còn hiệu lực**, vì stale worker vẫn có thể đã được SMTP chấp nhận. Nếu ack budget bị mất, slot HELD tiếp tục chiếm cap; reconciler chuyển HELD với lease hết hạn thành UNKNOWN, không refund tự động. Có thể reconcile thủ công từ log SMTP theo `Message-ID`/provider ref; thiếu chứng cứ thì giữ UNKNOWN, không gán ACCEPTED giả.

**Retry/replay:** mỗi SMTP call mới phải reserve slot mới, cả retry sau FAILED/UNKNOWN, CS resend, replay outbox và lời mời. Nếu hết cap: không gọi SMTP, không tăng provider attempt ordinal, không chuyển email sang DEAD, outbox để PENDING đến đầu ngày UTC kế tiếp (hoặc thời điểm cap nới), có reason nội bộ `email_budget_deferred`; ticket/invite tồn tại. Provider failure cuối theo retry policy hiện hữu là DEAD; quota defer không phải terminal provider failure và không được tính `emailNeedsCs` theo O12 (`DECISION-LOG:302`). Mọi đường email cần common admission/settle wrapper tại `processClaimedOutbox`, không ở riêng `sendTicketIssued`; `InvitationTokenMinted` không gửi, APNs không ăn email budget. Hành vi requeue của `retryNotificationDelivery` không tạo lại slot đã ACCEPTED; slot chỉ xuất hiện khi worker chuẩn bị gọi SMTP. Logical dedup dựa trên outbox/notification business key và operation key; SMTP thực tế vẫn at-least-once.

**UTC rollover:** đề xuất gắn `usage_date` bằng giờ DB UTC ngay ở admission trước SMTP, giữ ngày đó cho attempt kể cả ack sau 00:00. Đây là định nghĩa kỹ thuật “ngày bắt đầu SMTP attempt”; không tuyên bố chính xác theo giờ relay accept nếu I/O băng qua nửa đêm. Nếu product yêu cầu cap tuyệt đối theo ngày *accept* thực tế, cần quyết định thêm vì không thể biết/cưỡng chế ngày đó từ PG trước external I/O; không lén chuyển sang hourly hoặc double charge hai ngày. `email_today` API tiếp tục là **confirmed ACCEPTED** của UTC date, nên có thể nhỏ hơn sức chứa còn lại khi còn HELD/UNKNOWN; nếu UX cần “remaining”, định nghĩa riêng, không sửa DTO tùy ý.

## Migration, rollout, recovery, compatibility

1. Schema additive, backfill `held_count=0`; `sent_count` hiện có giữ nguyên. Dữ liệu lịch sử có thể thiếu accepted do writer chưa tồn tại; không bịa backfill từ `notifications`/outbox vì có duplicate và invite không có notification. Nếu prod đã gửi mail, ghi rõ mốc bắt đầu accounting/đối soát SMTP trước bật enforcement.
2. Deploy worker code cùng feature flag/gate chỉ bật sau khi **tất cả worker** dùng wrapper mới; không chạy worker cũ và mới gửi đồng thời vì worker cũ bypass budget. API producer vẫn commit outbox như hiện tại; request/response hiện hữu giữ PENDING. Triển khai RLS/grants/PG migration trước worker. Với limit nullable, usage write vẫn phải chạy.
3. Recovery forward: scan HELD lease quá hạn → UNKNOWN, không tự hoàn; xác nhận provider accept thì chuyển ACCEPTED; bằng chứng reject trước accept thì RELEASED; không rõ thì giữ hold và báo operator. Reclaim outbox có thể tiếp tục retry với slot mới khi còn cap. Dừng/rollback enforcement chỉ khi dừng worker sending hoặc có kế hoạch hợp nhất ledger; drop ledger/counter trong khi vẫn gửi sẽ mất khả năng kiểm toán, nên rollback code nên là forward fix.
4. Giữ `tenant_limits.email_per_day` nullable và self-serve 100/day; không dùng `tenantCapPerHour?` để suy ra daily. Existing N1 rate caps (staff/recipient hourly) và CS 60s/ticket, 10/h/staff vẫn là contract riêng; nếu sửa race audit across tickets, dùng atomic counter/lock cùng transaction, không đổi số. Chưa có quyết định đổi HTTP 429 vs PENDING khi tenant budget đầy: đề xuất PENDING/defer vì quota được kiểm tại relay, không phải command admission.

## Handoff owner và test matrix tối thiểu

| Owner | Việc trong scope JOB-04 |
| --- | --- |
| Backend/DB | Migration ledger + usage held, RLS/grants; helper reserve/settle CAS; reconciliation UNKNOWN; nonnegative/limit invariant; fix lookup resend business key theo outbox payload thay hardcode. |
| Worker | Bọc cả ba send paths, typed SMTP outcome cho plain/MIME, defer quota không consume retry, settle budget độc lập outbox lease; log/metric không PII. |
| API | Giữ command idempotency/cooldown và response PENDING; bảo đảm không truyền hourly cap giả; xem xét atomic staff 10/h across tickets. Không thêm endpoint/contract public nếu không cần. |
| Coordinator | Quyết scope contract và business questions dưới đây, giao đúng slice, kiểm tra exact SHA/gate D/H theo PLAN; không mở lại JOB-01–03/PORT-09 hoặc JOB-08. |

| Test/evidence cần có | Mapping |
| --- | --- |
| D: 2+ worker/tenant đồng thời khi limit=1; một admission, không SMTP thứ hai. Limit 0/null, thiếu row, operator hạ/nâng limit, hai tenant độc lập/RLS, UTC boundary. | JOB-04 tenant cap; JOB-06 overlap invariant |
| D: ACCEPTED settle exactly once; timeout/crash after accept before ack giữ HELD→UNKNOWN; replay mới cần slot; definite pre-accept reject release; failure cuối/defer không sửa `sent_count` sai; stale lease vẫn settle budget. | JOB-03 compatibility; JOB-04 retry/final/status |
| D: ticket issue, CS resend, N1 notification retry, MembershipInvite, InvitationReady đều cùng admission; operation replay không tạo logical resend mới; concurrent staff resend nhiều ticket giữ 10/h, ticket cooldown 60s. | JOB-04 resend/dedup/user limit |
| H: API resend 1st/replay/cooldown/user cap; tenant cap khi queue đầy có status PENDING rõ, notification chỉ PENDING/ACCEPTED/FAILED/DEAD/UNKNOWN, `emailNeedsCs` chỉ terminal; `ACCEPTED` copy không nói delivered. | PLAN JOB-04 D/H; O12 |
| R chỉ khi coordinator giao riêng: Mailpit SMTP accept/timeout + worker kill/restart để kiểm tra claim/ack và conservative holds; không suy R pass từ D/H. | JOB-03/JOB-06 còn lại, ngoài dispatch thiết kế này |

**Chưa kiểm:** runtime, migration, H/D/R, quota prod; chưa kiểm truy vết log SMTP thực tế. `gh issue view 1032` chỉ xác nhận scope/gate full AC, không cung cấp quyết định mới về quota semantics.

## Quyết định cần coordinator xử lý

1. **Trong quyền fix hiện có:** chấp nhận/điều chỉnh worker admission theo từng SMTP invocation, ledger HELD/UNKNOWN conservative, UTC admission-date và quota exhausted → PENDING/defer; bảo đảm không mở cap mới. Nếu cần đổi ý nghĩa “email/ngày” sang **ngày SMTP ACCEPTED thực tế** hoặc reject command ngay tại API, đây là business policy khác với đề xuất và cần hỏi product/user trước khi code.
2. **Trong quyền fix hiện có:** xác nhận conservative UNKNOWN giữ slot đến khi có bằng chứng; nếu muốn tự động refund UNKNOWN theo TTL thì đó là quyết định rủi ro over-send, không nên ngầm áp dụng.
3. Nếu requirement thực tế là **một email duy nhất** kể cả crash sau SMTP accept, SMTP hiện tại không chứng minh được; cần provider idempotency/dedup contract riêng, không gắn nhãn JOB-04 PASS bằng logical DB dedup.

**Kết luận:** Đủ để coordinator quyết hướng triển khai trong scope đã có; chưa đủ để tuyên bố JOB-04 pass. Các điểm vượt quyền business được nêu riêng ở trên, không giả định đã duyệt.

## Quyết định coordinator Minh — 2026-10-31 03:18 UTC

Chấp nhận phương án B trong quyền user “Fix hết đi”: daily budget tại mỗi SMTP invocation, UTC admission-date; ACCEPTED là relay nhận, UNKNOWN giữ slot, không TTL refund; quota đầy PENDING/defer không terminal, không đổi số cap/HTTP policy. Không có quyết định yêu cầu exactly-once SMTP.

Làm rõ invariant: admission chỉ được tăng tổng khi tổng hiện tại < limit; nếu operator giảm limit dưới usage đã chiếm thì không thể hứa tổng<=limit tại mọi commit. Giữ history và chặn admission mới, không trừ ngược. Với null vẫn ledger/accounting; thiếu config fail closed nhưng phải report/defer có thể phục hồi, không vòng lặp nóng. Settlement RELEASED chỉ khi có chứng cứ definite no-accept, kể cả reconcile UNKNOWN với chứng cứ mới; tuyệt đối không refund do TTL/lease hết. Outbox quota defer không tiêu hao provider retry budget; đếm claim attempts nội bộ cần tách khỏi SMTP attempts nếu hiện tại dùng chung. Không gọi lại SMTP với cùng admission attempt/lease; recovery phải lease token mới và slot mới. Schema không được drop/reset dữ liệu. Rollout/deploy không thuộc wave này.

Implementation vẫn phải review độc lập exact SHA và D/H tenant cap thật; các run partial cũ không biến thành PASS toàn nhóm. Finding mới business-key/staff race phải có source/test và giữ scope hẹp, không dùng nhãn compatibility để mở lại case đã đóng.
