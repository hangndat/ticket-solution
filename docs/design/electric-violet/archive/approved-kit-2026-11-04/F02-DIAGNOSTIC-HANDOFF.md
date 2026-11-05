# F02 — đề xuất chẩn đoán auth iOS, chưa triển khai

Branding/theme đã áp và không có diff trong identity files. F02 vẫn thiếu bằng chứng signed-in ticket/QR: app trở về guest sau Keycloak. Không có căn cứ coi đây là lỗi nhận diện.

## Evidence đã có

- Local API health và issuer discovery trả 200; simulator build có marker SHA/API/config đúng. Client `ticket-mobile` chấp nhận authorize preflight với `vemoki://oauth/callback`.
- Zico đã thực hiện một lượt diagnosis bounded: callback thực tế/code exchange/verify/persistence chưa phân biệt được qua log hiện có. Không lặp UI sign-in nữa khi chưa có marker mới.
- Coordinator probe protocol-only bằng fixture local: direct grant trả 400 `unauthorized_client`; chuyển sang luồng Code+PKCE được client hỗ trợ nhưng POST authorize trả 400 và không có callback, nên chưa lấy được `/v1/me` status. Probe không phải UI acceptance, không thay đổi config/client hay lưu token/credential. Không kết luận từ probe này rằng lỗi UI ở cùng stage.

## Đề xuất scope để identity owner thực hiện sau quyết định mở rộng

Một patch diagnostic chỉ bật trong build local UAT, không đổi protocol/session behavior:

1. `apps/mobile/src/identity/oidc-login.ts`: marker allowlisted cho auth-session result type, exchange bắt đầu/thành công/thất bại. Không log callback URL, request/result object, authorization code, state, verifier hoặc token.
2. `apps/mobile/src/identity/fetch-me.ts`: marker allowlisted cho `me` outcome và HTTP status (không body, headers, userId hoặc claims).
3. `apps/mobile/src/attendee/use-attendee-sign-in.ts`: marker snapshot status sau establish và error stage cho persistence khi phân biệt được, không error.message/raw exception. Dùng một trace ID random ngắn không gắn identity, chỉ trong memory/log local; không gửi telemetry ngoài máy.

Ưu tiên logger/capability UAT hiện có. Gate bằng local-fixture capability **và** explicit diagnostic flag mặc định tắt, bị khóa tắt ở production APS; không mở auth/session bypass. Owner identity cần kiểm code/session contract trước chọn implementation; đây là đề xuất, chưa sửa source.

Chỉ chạy một lượt real OIDC qua Orca sau khi có marker và provenance build. Nếu stage xác định: dừng, giao sửa nguyên nhân theo owner/risk riêng; không tự sửa auth trong task branding. Nếu không xác định: giữ blocker và không lặp. Khi session verified mới thu signed-in wallet/ticket QR/O28 evidence. Loại bỏ hoặc tắt hoàn toàn diagnostic trước review tích hợp; revalidate thay đổi và checks liên quan, không gọi dirty local thành exact-commit DoD.

Phạm vi mở rộng cần quyết định: cho phép identity owner thêm diagnostic local ở ba file trên, với review độc lập auth-sensitive và không production/cloud/store. Công việc chưa được dispatch hoặc thực hiện trong đợt apply nhận diện.
