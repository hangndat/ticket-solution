# Nghiên cứu tiếp Dashboard vận hành

Ngày: 18/10/2026. Trạng thái: dictionary/pha **đã chốt O12** (2026-10-18) — xem [DECISION-LOG O12](../DECISION-LOG.md#o12--dashboard-m11-dictionary-kpi-và-pha-triển-khai-18102026) và [tổng hợp](./DASHBOARD-MARKET-SYNTHESIS.md). Chưa tự ủy quyền coding từ file này.

## 1. Phạm vi và bằng chứng

Yêu cầu: nghiên cứu tiếp phần Dashboard. Nghiên cứu bàn giấy từ PRD M11, Technical Design §16, Decision Log và source tại `e8512d0055e0e9d6585007e8363b6224a7138b12`; chưa phỏng vấn người vận hành, chưa chạy UAT hoặc đo tải. Không xem các giả thuyết UX dưới đây là kết quả nghiên cứu người dùng.

Đối chiếu trực tiếp Project #3 bằng `gh project item-list 3 --owner hangndat --format json --limit 200` ngày 18/10/2026:

- #22 web admin có Dashboard: Hoàn thành trên board; không tự chứng minh đầy đủ PRD M11.
- #228 / #229 admin workspace và readiness: Đang làm; cần tránh chồng ownership.
- D11 đã duyệt không mở metrics mới. Yêu cầu nghiên cứu này cho phép chuẩn bị đề xuất, chưa cho phép thay API, code tính năng hoặc remote integration.

Nguồn source: `packages/backend/src/reporting.ts`, `apps/api/src/reporting.ts`, `apps/web/src/admin/report.ts`, `apps/web/app/admin/admin-form.tsx`; test đã đọc: `packages/backend/test/reporting.test.cjs`, `apps/web/tests/admin-report.test.ts`. Knowledge graph không có trong phiên; dùng source trực tiếp. Không chạy lại test trong nghiên cứu này.

## 2. Bài toán và kết quả cần đạt

Giả thuyết: người quản lý cần biết việc gì cần xử lý và dữ liệu có đáng tin tại thời điểm xem, trước khi cần thêm biểu đồ.

| Người dùng | Câu hỏi cần trả lời | Hành động phù hợp |
| --- | --- | --- |
| Event Manager | Còn khả năng phát vé? Có yêu cầu chờ duyệt? | Mở quota/nguồn hoặc danh sách duyệt theo quyền |
| Supervisor | Server đã ghi nhận bao nhiêu lượt vào? Có lỗi cổng hay đồng bộ chậm? | Mở màn cổng/đối soát được cấp quyền |
| CS | Những thông báo nào cần hỗ trợ gửi lại? | Mở danh sách lỗi, không tự resend từ thẻ KPI |
| Tenant Owner | Sự kiện nào cần chú ý? | Chọn event; tổng quan nhiều event để pha sau |

Scanner không mặc định được xem toàn bộ báo cáo. Platform health/DB/queue và Dashboard nghiệp vụ là hai bề mặt có tập quyền riêng.

## 3. Khoảng cách dữ liệu hiện tại

API hiện có: `GET /v1/tenants/{tenantId}/events/{eventId}/report`. Chỉ trả trạng thái vé, quota event và số chờ duyệt; chưa có timestamp dữ liệu, breakdown theo cổng, email hoặc chuỗi thời gian.

| Chỉ số | Dữ liệu hiện có / định nghĩa đề xuất | Giới hạn cần thể hiện |
| --- | --- | --- |
| Vé đang hiệu lực | `ticketsByState.ACTIVE` | Không gọi là tổng vé đã phát |
| Vé đã sử dụng | `ticketsByState.USED` | Là trạng thái hiện tại trong DB, chưa chứng minh số người đang có mặt |
| Vé thu hồi / hủy | `REVOKED` / `CANCELLED` riêng biệt | Không gộp mất lý do nghiệp vụ |
| Chờ duyệt | `pendingApprovalCount`: request `PENDING_REVIEW` | Không giữ quota và không đảm bảo còn suất khi duyệt |
| Quota event | `capacity`, `allocated` từ bucket EVENT | Không suy ra quota nguồn/loại vé |
| Quota còn theo event | Đề xuất `capacity - allocated` khi hữu hạn | Không gọi là số vé chắc chắn có thể cấp; bucket nguồn/loại có thể hết trước |
| Mã khả dụng | Chưa có trong report | Cần định nghĩa trạng thái, expiry, pending và cửa sổ phát hành; không lấy tổng mã trừ tổng vé |
| Email cần xử lý | Chưa có trong report | Tách đang retry và lỗi cuối; ACCEPTED không phải DELIVERED/đã đọc |
| Check-in theo cổng/lý do | Chưa có trong report | Đếm operation/kết quả có định nghĩa; retry không tạo thêm lượt vào thành công |
| Xu hướng theo thời gian | Chưa có trong report | Cần timezone, event-time/server-time và quy tắc nhận dữ liệu offline muộn |

`capacity=null` hiện biểu diễn không giới hạn, nhưng backend cũng trả null khi không tìm thấy quota bucket. Trước khi dùng làm readiness hoặc kết luận “không giới hạn”, cần phân biệt hai trường hợp bằng contract hoặc invariant có bằng chứng. Không tự đổi contract trong nghiên cứu này.

Không dùng tổng bốn trạng thái vé làm “đã phát lũy kế” trước khi xác minh đầy đủ vòng đời hủy/phát hành lại. Không dùng `allocated` thay số vé đang hiệu lực.

## 4. Bố cục đề xuất

Web event Dashboard, từ trên xuống:

1. Tên tenant → tên event, timezone, phạm vi số liệu, thời điểm dữ liệu và nút tải lại.
2. “Cần xử lý”: chờ duyệt; ở pha sau thêm lỗi email/đồng bộ có dữ liệu thật. Mỗi mục dẫn đến workflow đã có và kiểm tra quyền đích.
3. Tóm tắt vé: đang hiệu lực, đã sử dụng, thu hồi, hủy; quota event và chờ duyệt, kèm định nghĩa ngắn.
4. Pha mở rộng: breakdown nguồn/loại vé, cổng/lý do và xu hướng; chỉ thêm sau khi duyệt định nghĩa/contract.

Readiness trước giờ mở thuộc workspace #229; Dashboard số liệu dẫn về đó thay vì xây checklist thứ hai. Không nhét biểu đồ trang trí hoặc dữ liệu fixture vào runtime thật. iOS chỉ đề xuất tóm tắt theo quyền; chưa giao triển khai mobile.

## 5. Độ tin cậy, offline và quyền

- API hiện đọc nhiều câu SELECT riêng. Chưa đủ bằng chứng snapshot nhất quán giữa vé/quota/pending khi có giao dịch đồng thời; cần chọn snapshot transaction hoặc aggregate version nhất quán trước nghiệm thu đối soát.
- Mục tiêu PRD ≤10 giây là độ trễ dữ liệu trong tải pilot, không phải cứ poll 10 giây là đạt. Phải đo từ transaction commit đến số liệu hiển thị, gồm cập nhật aggregate và request/render.
- Giờ trình duyệt nhận response chỉ nên ghi “Tải lúc”; không thay được `dataAsOf`/watermark do server xác lập. Contract tương lai phải thống nhất ngữ nghĩa timestamp, không tự thêm trường UI.
- Gate offline: server chưa biết toàn bộ lượt vào tại thiết bị chưa đồng bộ. Ghi “Server đã ghi nhận”; không hiển thị “đã đồng bộ tất cả” khi chưa có coverage thiết bị. Không hứa SLA 10 giây cho thao tác chưa đến server.
- Phân biệt đang tải, hợp lệ bằng 0, không có quyền, lỗi mạng, dữ liệu cũ và chưa xác định. Parser hiện ẩn số khi unknown/partial response; giữ hành vi đó cho đến khi có thiết kế stale được duyệt.
- Đổi tenant/event phải xóa số cũ và hủy/bỏ response về muộn của scope trước. Thu hồi quyền phải chặn request kế tiếp; không giữ số cũ trên màn hình sau lỗi quyền.
- Backend kiểm tra `report.read` và event assignment trong tenant transaction. Aggregate vẫn phải kiểm tra tenant/event và quyền mỗi lần; cache có key tenant/event/phạm vi quyền phù hợp. Không dùng quyền xem báo cáo để suy ra quyền export, CS hoặc resend.
- Backend hiện chạy COUNT/GROUP BY theo event mỗi lần đọc. Có filter không đồng nghĩa đáp ứng yêu cầu aggregate của TD. Cần query plan và load evidence; không mở auto-poll dày trước khi có cơ chế aggregate, timeout/concurrency cap và giảm tải ưu tiên Gate.

## 6. Roadmap đề xuất để review

Không đặt mã đợt mới hoặc tự ghi Task Hoàn thành trên Project. Các dòng sau là kế hoạch đề xuất, chưa phải dispatch.

| Bước | Ownership / Role | Đầu ra và điều kiện |
| --- | --- | --- |
| A. Chốt nghiệp vụ | product-ba — `docs/agents/roles/product-ba.md` | Từ điển chỉ số; persona/quyền; thống nhất quota, vé đã phát và offline; user review phạm vi |
| B. Thiết kế trạng thái | product-design — `docs/agents/roles/product-design.md` | Flow, responsive, copy VI, keyboard/focus, empty/loading/denied/stale; phối hợp #229 |
| C. Contract và kế hoạch đo | Coordinator + backend — `docs/agents/roles/backend.md` | Duyệt snapshot/timestamp/aggregate, query budget, permission; regenerate contracts nếu có thay đổi |
| D. Tóm tắt event | web — `docs/agents/roles/web.md` | Bố cục dùng chỉ số được duyệt, workflow links, headless UAT đa tenant |
| E. Vận hành mở rộng | backend + web theo ownership | Email/cổng/xu hướng sau khi có contract và test nguồn thật; không phụ thuộc D để làm backend nếu C đã chốt |
| F. Review độc lập | reviewer-dod + reviewer-security theo `docs/agents/roles/` | Exact-SHA, authz/RLS/cache/revoke, concurrency, headless UAT và evidence hiệu năng |

A phải chốt trước C; B có thể tiến hành cùng phần khảo sát kỹ thuật của C. Sau contract C, backend các nhóm dữ liệu độc lập có thể chạy song song trong giới hạn ownership; web dùng contract đã duyệt. Không serialize theo Story nếu không có phụ thuộc thật; không tranh feature coding slot web đang dành #229.

## 7. Tiêu chí nghiệm thu dự kiến

1. Fixture hai tenant, nhiều event: tổng hợp đúng nguồn; truy cập chéo, event chưa được phân công và membership bị thu hồi đều bị chặn, UI không giữ số scope cũ.
2. Fixture có ACTIVE/USED/REVOKED/CANCELLED, pending, quota hữu hạn/null và bucket thiếu: copy đúng định nghĩa, không coi dữ liệu thiếu là 0/không giới hạn.
3. Tranh suất cuối và check-in retry: số liệu đối soát theo snapshot/watermark đã chọn; không nhân đôi do retry. Cần test giao dịch thật, build xanh chưa đủ.
4. 500/timeout/response thiếu/lỗi quyền và response về muộn sau đổi event: không hiện số sai như số hiện tại; phục hồi bằng tải lại có trạng thái rõ.
5. Hai thiết bị Gate offline: trước sync chỉ báo server đã ghi nhận; sau sync APPLIED/DUPLICATE/CONFLICT được tính theo định nghĩa được duyệt, không cộng mọi attempt thành lượt vào.
6. Load theo TD S1 (event 50k vé, hai tenant): ghi phân phối độ trễ commit→UI, query plan, pool/lock wait và ảnh hưởng Gate. Chốt tiêu chí percentile/tải pilot trước test; không tự tuyên bố đạt mục tiêu ≤10 giây.
7. Headless web qua `scripts/web-uat.sh`: keyboard/focus, layout hẹp, số liệu/nhãn không chỉ phân biệt bằng màu; artifacts gắn exact SHA. Mobile nếu được mở scope phải có headless sim UAT và local Xcode build; cấm EAS Cloud Build.

Chỉ số đánh giá đề xuất: thời gian tìm đúng việc cần xử lý trong bài test vận hành; tỷ lệ hiểu đúng quota/pending/offline; độ trễ dữ liệu; tỷ lệ đối soát sai. Baseline và ngưỡng UX chưa đo/chưa chốt, không điền số giả.

## 8. Quyết định — đã chốt O12

Các điểm mở ở bản đề xuất đã được user chốt vào **O12** (18/10/2026). File này giữ làm bằng chứng nghiên cứu nội bộ trước spawn BA; khi triển khai lấy dictionary/wave từ Decision Log O12 + [DASHBOARD-MARKET-SYNTHESIS](./DASHBOARD-MARKET-SYNTHESIS.md).

Kết quả nghiên cứu này không phải code complete, acceptance complete hay pilot ready. Coding Dashboard vẫn cần ủy quyền/dispatch riêng.
