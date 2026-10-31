# Local E2E seed fixture

## Đã cấu hình

- Mỗi case có tenant, identity Keycloak riêng và code riêng; Owner/Manager/CS/Scanner/Supervisor dùng server role map và event assignment. `PORT-01` không có event trước wizard; `PORT-12` owner chưa có membership.
- Event được publish với đủ sáu fixed sections, form và terms hợp lệ. AUTO/MANUAL của `WEB-13` nằm trên hai event khác nhau, với catalog, quota và CSV GUESTS riêng; `PORT-06` có request MANUAL pending; `PORT-07` bắt đầu với zero gates.
- Ticket owned được tạo cho `AUTH-07`, `WEB-09`, `WEB-11`; `AUTH-08` dùng account riêng. `PORT-08` lấy expected report từ `readEventReport` sau khi issue ticket thật. `SEC-01` có tenant/event thứ hai mà owner case không được cấp quyền.
- Manifest private của run mang `e2e-http` client secret chỉ cho HTTP harness. `PORT-05` có CSV code tổng hợp và catalog label; `PORT-11` có invitee Keycloak verified chưa là member.
- HTTP smoke bổ sung `AUTH-03`/`DB-03` formVersion, termsVersion và answers hợp lệ; `GATE-01` có foreignEventId cùng tenant, không assignment; `GATE-03` có ticket ACTIVE owned.
- `WEB-01` có main event `PUBLIC` đã publish, draft event có config chưa publish, và private event `UNLISTED` đã publish. Manifest có ID/slug riêng cho cả hai event phụ. `PORT-03` có clone name/slug chưa dùng. `PORT-10` có hai event được Owner gán `report.read`, một event đã publish nhưng assignment Owner bị revoke, và event visible thứ hai không có quota bucket để báo `UNKNOWN` thật.
- `PLAT-02` có tenant `PENDING` riêng cho activation và tenant thứ hai được chuyển sang `SUSPENDED` sau khi cấp vé thật; manifest lưu pending/suspended tenant ID và suspended event/ticket ID. `PORT-12` vẫn không có membership Owner.

## Kiểm tra

- `node --check tests/e2e/harness/seed.mjs`: PASS.
- `requireValidConfigPayload` từ backend dist chấp nhận đúng sáu section và form; `validateFormAnswers` chấp nhận answers tổng hợp: PASS.
- Leader đã chạy HTTP 5 case PASS trên PG/RLS/Keycloak isolated (run `mvs7c4zn-e4e2b9`) trước phần mở rộng fixture này. Phần mở rộng `WEB-01`, `PORT-03`, `PORT-10`, `PLAT-02` mới qua `node --check tests/e2e/harness/seed.mjs`; chưa chạy seed/runtime/browser trên stack. HTTP/browser assertions còn thuộc leader và backend worker.

## Gap còn lại

- Các nhánh mở rộng trong `WEB-04/09`, `AUTH-05/06`, `PORT-05/06`, `PORT-11`, `SEC-01/02` cần state/control riêng theo FIXTURES và browser/backend specs; fixture hiện chỉ phục vụ smoke chính. `PORT-09` thiếu đủ provider states, các case fault/time travel chưa có harness control.
- `WEB-01` có bất đồng contract ngoài seed: PRD M03 yêu cầu event private mở bằng direct link; ADR-19 và `getPublishedEventDetail` hiện chỉ trả `visibility=PUBLIC`, và browser spec hiện kỳ vọng private direct link không có `event-published`. Theo chỉ đạo leader, fixture giữ private event `UNLISTED` đã publish; leader sẽ đối chiếu quyết định và giao sửa assertion direct link theo requirement nếu không có override. Không tính direct-link assertion PASS ở bước seed.
- `PORT-08` seeds one ACTIVE ticket, one `PENDING_REVIEW` hold on a second code, and one terminal email `DEAD` (not revoke/cancel last_error); `data.report` is `readEventReport` after seed. Confirm APPLIED/undo/reject remains Gate/DB-15, not Portal.
