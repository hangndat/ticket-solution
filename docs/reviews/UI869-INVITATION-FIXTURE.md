# Fixture email-link local — #869/F07

Minh/root, 2026-10-24. Source base109e0c5 + helper mới trong working tree. Dùng supported backend services, không sửa API/backend/auth: GUESTS CSV upload vào MinIO → create/preview/commit → dispatch-preview/dispatch → outbox relay với SMTP adapter gửi vào Mailpit127.0.0.1:1026.

- First run: created=true, outboxFailures=0; second run: created=false, outboxFailures=0, không thêm lời mời hoặc email trùng.
- Mailpit API: total4; có subject “Lời mời tham dự — MFest · Demo”, ba email vé fixture cũ được outbox xử lý cùng. Chỉ lưu subject/count trong report, không lưu body/link/token.
- DB sau seed:1 guest_invitations,3 tickets,25 codes. Không issue/claim trong seed; không reset hoặc tiêu thụ DEMO-MFEST-002.
- Negative guard: DATABASE_URL trỏ database khác → exit1/local_fixture_target_required trước kết nối/mutation. SMTP/MinIO cũng bắt buộc loopback.
- Lời mời thực cho attendee@example.com, TTL48h theo contract. Không refresh/re-enable lời mời đã hết hạn/revoked/claimed. Khi đã claim, state đó được giữ. Link/token chỉ ở `.local-dev/ui869/invitation.json`0600 và Mailpit local; file ignored, không commit. `open` chỉ in browserPageId, caller phải đóng tab.

Linh được giao dùng fixture này để UAT link→login→terms→claim (nếu thành công, counts sẽ đổi; worker report phải ghi). Không UAT bằng submit yêu cầu xóa tài khoản.
