# D13 — S2-T1 kiểm tra runtime trước phát hành

Ngày: 2026-10-18. Epic #301. Coordinator session `codex_e4d5db07_a531_4587_a319_3f80d3ac690a`; Run `run_1af161001850`.

- Integration source SHA: `f551b6d2bdc06742f74a49a0970cb2bfae2f4e0e`. Context ops branch chưa merge: `bb9ebe80a2113df46c48188e9021d750d9412e23`; không kế thừa acceptance từ commit này.
- Marker trên VPS (SSH read-only, `cat /opt/vemoki/deployed-sha.txt`): `0a65f3c2f2d51357ee1a6270151d279758188fb7`. Không suy rằng marker đại diện mọi thay đổi ops thủ công.
- HTTP GET bằng Python urllib: `https://vemoki.com/privacy`, `https://api.vemoki.com/v1/health`, `https://auth.vemoki.com/realms/ticket/.well-known/openid-configuration`, `https://app.vemoki.com/` đều **200**.
- `docker ps`: api/worker/web chạy; keycloak/minio/postgres/mailpit healthy.
- `docker exec vemoki-worker-1 node -e` chỉ xuất flags allowlist: SMTP hostname **mailpit**; APNS_ENABLED=true; APNS_PRODUCTION=true; TICKET_CREDENTIAL_KEY present. Không in giá trị secret.

## Verdict

**NO-GO cho submit bản store** khi luồng bắt buộc cần email nhưng chỉ tới Mailpit. HTTP 200 chỉ chứng minh endpoint sống, không chứng minh luồng đăng nhập/nhận vé/xóa tài khoản chạy E2E.

Đã gửi user yêu cầu cấu hình SMTP_URL/SMTP_FROM qua kênh bảo mật hoặc chỉ đường dẫn credential hiện có; không yêu cầu gửi mật khẩu chat. Chưa thay cấu hình, gửi email thật hay deploy trong kiểm tra này.

## Evidence đã có cần phân biệt

`PILOT-GATES-2026-10-18.md` trên branch ops chưa merge (context only) mới hơn D12 GO-NO-GO: on-call đã điền; Postfix đã cài, outbound25 timeout, Porkbun587 mở nhưng thiếu credential ở lần kiểm tra đó. APNs sandbox ACCEPTED tại lần trước và DELIVERED evidence prior không chứng minh production push trên binary store D13.

## Giới hạn

Chưa device UAT, chưa signed distribution archive D13, chưa ASC submit/publish. Không claim production/pilot ready. Chưa requeue notification hay sửa business data. Artifact là implementer evidence, cần independent DoD trước acceptance.
