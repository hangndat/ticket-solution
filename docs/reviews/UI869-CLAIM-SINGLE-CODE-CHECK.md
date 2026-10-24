# Kiểm tra single-code và bốn ô scope trong ảnh user

Ngày 2026-10-24; source `109e0c59066498071f95fdf6e4851f2d4f6af6d9`. Yêu cầu hiện tại: kiểm tra lại, **không sửa source** hoặc bật flag production. F01 shutdown vẫn Bị chặn, counter2/2 + ngoại lệ đã dùng không đổi.

## Kết quả

Single-code đã có: `packages/backend/src/code-routing.ts:60` reserve namespace toàn cục và reject duplicate qua routing key/digest alias; `packages/contracts/src/redemption-resolve.ts` nhận body chỉ `{code}`. Response có tenantId/eventId, tên tổ chức/sự kiện/loại vé, context form/terms đã publish và resolve token. Legacy ambiguity fail-closed, không tự chọn sự kiện. Không cần người dùng nhập slug/UUID trong flow này.

Probe read-only API local với fixture `DEMO-MFEST-002`, đăng nhập Keycloak thật: HTTP201, `redemptionFlow=global`, tenant=MFest, event=MFest · Demo, ticketType=General, tenantId/eventId/resolveToken có đủ, terms có; form=null vì fixture không cấu hình form. Không in bearer/resolve token. Không gọi issue; vé vẫn3. DB có25 routing groups, ambiguous=0. Local script bật SINGLE_CODE_RESOLVE_GLOBAL/NEXT_PUBLIC_SINGLE_CODE_RESOLVE; không suy ra tình trạng production.

Ảnh khớp chính xác thứ tự và nhãn tại `apps/web/app/(consumer)/claim/claim-form.tsx:376–423`. Đây là **nhận lời mời**: bốn field slug/UUID render vô điều kiện; `readClaimTokenFromLocation` lấy context từ fragment/parked intent, nhưng UI vẫn cho nhập/sửa. `submitClaim` yêu cầu tenantId/eventId và dùng API tenant-bound `POST /v1/tenants/{t}/events/{e}/invitations/claim`; nó không gọi global redemption resolver. Invitation token khác redemption code, hiện backend claim còn kiểm email được mời/verified và token trong tenant scope.

`/redeem` không query scope dùng attendeeSingleCodeSurface, chỉ nhập code; URL pin scope còn nhánh legacy/dev nâng cao. Không có chứng cứ user đi vào ảnh qua URL nào; nguồn component được xác định bằng nhãn/thứ tự field, không suy đoán đường click.

## Kết luận UX cần xử lý sau quyết định scope

Bốn ô là technical scope đang lộ trong claim UI; không phải bằng chứng thiếu global uniqueness. Flow đổi mã dùng resolver hiện có. Flow nhận lời mời nên nhận context từ link hợp lệ và giữ nội bộ, tự tải thông tin/form/terms; thiếu context hiển thị trạng thái liên kết thiếu/không hợp lệ thay vì yêu cầu khách điền UUID. Không đưa invitation token vào redemption resolver hoặc bỏ email/tenant validation để gộp hai flow.

Đây là nhánh UI cũ bị bỏ sót trong review trước, không phải regression do diff ngoại lệ109e0c5. Chưa sửa, chưa nghiệm thu flow claim mới, không tự mở Epic/Issue hay reset số lượt sửa.
