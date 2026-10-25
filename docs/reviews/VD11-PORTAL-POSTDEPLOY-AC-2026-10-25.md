# Portal — AC bổ sung khi user review production

## P-F05 theme shell

Theo checkpoint `VD11-PORTAL-P05-2026-10-25.md`: fix VD11 2/2, ngoại lệ 1/1 đã dùng. Tenant/event dropdown mở, selected/hover/focus và account menu phải có light surface/ink đủ đọc; sidebar tối giữ mẫu. Kiểm 390/1024/1440, bàn phím, không overflow. Đây là finding bị bỏ sót có ảnh mới, không reset batch.

## Context cache — yêu cầu mới user cùng phiên

“việc chọn tổ chức và sự kiện thì lưu local cache đi, mỗi lần vào đều bắt setup tạo”. Lưu preference IDs theo verified userId từ BFF subject. Không lưu token/quyền/nội dung business. Restore chỉ sau discovery, tenant phải ACTIVE staff membership, event phải thuộc tenant trong server discovery. Cache không thay auth/authorization. URL explicit thắng cache; invalid link không redirect sang tenant khác. Home ưu tiên lựa chọn hợp lệ đã dùng, tránh checklist setup lặp; pending/SUSPENDED, user mới chưa có tenant và explicit onboarding giữ flow hiện hành, không ghi completed/ACTIVE bằng cache.

Chọn event → reload/new tab/home nhớ đúng; đổi tenant không mang event tenant cũ; clear event phải clear ngay UI, menu và storage rồi reload/home vẫn clear. Org subroute có thể giữ event context nếu vẫn hợp lệ. User khác không dùng prefs user trước. Malformed, storage unavailable, revoked tenant/event phải graceful, không cấp quyền. Không đổi backend, auth routes, dependencies, web hoặc iOS. Đây là implementation đầu của AC mới; batch fix 0/2, độc lập với bộ đếm P-F05.

Nghiệm thu: tests hành vi storage/resolve, typecheck/build, lint mục tiêu và authentic OIDC local browser UAT. Không gọi production auth UAT nếu chỉ smoke guest; không mock permissions. Reviewer độc lập với Linh, exact SHA và verdict DoD/UI trong artifact. P-F05 FAIL lần ngoại lệ thì dừng; cache finding dùng ID C-Fxx và giữ bộ đếm xuyên phiên.
