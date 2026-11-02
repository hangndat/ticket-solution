# Skills đa host

Nguồn chuẩn được Git theo dõi: `.agents/skills/` ở root repo. Khi sửa skill, sửa tại đây. `.cursor/skills` là symlink `../.agents/skills`, nên hai host đọc cùng nội dung, không cần chép file để đồng bộ.

Lượt chuyển 02/11/2026 đã đối chiếu đủ 5 file của 4 skill: deploy-prod, ios-usb-device, launch-uat và vemoki-design-system (kèm reference); hai bộ cũ có nội dung giống nhau. Bản cũ Cursor được lưu tạm ngoài repo trước khi nối.

Checkout mới phải giữ symlink của Git. Nếu filesystem/host không hỗ trợ symlink, tạo bản mirror từ nguồn chuẩn bằng bước setup có kiểm diff; không chỉnh mirror, không ghi đè file khác biệt. Các overlay khác trong .agents và .codex vẫn local theo .gitignore. Không đồng bộ secrets hoặc settings tài khoản.

Metadata skill chỉ phục vụ discovery; trước thực thi phải đọc SKILL.md. Quyền deploy/store/UAT và các gate theo AGENTS/policy vẫn áp dụng.
