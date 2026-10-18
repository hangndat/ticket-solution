# D13 — Cấu hình runtime cho xóa danh tính

Epic #301 · Task #351 / #319. Architecture impact: **Có** — tách credential Admin IdP khỏi API; schema env đã thống nhất với backend qua Orca `msg_94399e50b65e` / `msg_cb8ef4a670bb`.

`infra/deploy/compose.yaml` truyền keyring và current key ID chung cho API/worker; client secret xóa Keycloak chỉ vào worker. Ví dụ env ghi đúng schema `{keyId,secretBase64}`, mỗi key ≥32 random bytes, giữ key cũ đến khi mọi digest tương ứng hết hạn. Không có key thật trong thay đổi này. Worker nhận cùng issuer cố định như API; Admin base URL/realm là cấu hình tin cậy của ops, backend phải đối chiếu allowlist.

Erasure mặc định `0`; cấu hình vắng/tắt phải giữ yêu cầu pending và không được đánh dấu hoàn thành chỉ vì PostgreSQL đã ẩn danh. Đây là acceptance bắt buộc của implementation #351, **chưa phải evidence runtime đã có hành vi đó**. Root không thay backend trong PR cấu hình này.

SMTP URL được đọc từ env thay vì hardcode Mailpit. Khi chưa cấu hình vẫn là Mailpit: gate email production #319 **còn bị chặn**, không coi fallback là gửi email thật. Không có credential SMTP được thêm.

Kiểm tra local: `docker compose --env-file infra/deploy/.env.example -f infra/deploy/compose.yaml config --quiet`; parse JSON trong memory và assert SMTP override, erasure0, Admin secret không vào API/web, keyring/issuer API-worker giống nhau; `git diff --check` đạt. Không in JSON đã resolve hoặc credential.

Chưa provision client/keyring thật, chưa bật erasure, chưa deploy production, chưa chạy live deletion E2E. Trước bật live cần implementation #351 reviewed/merged, migration, quyền tối thiểu client, sub=UUID/realm đúng, keyring nhất quán, và evidence xóa tài khoản fixture thực tế. Hoàn thành cấu hình không đóng #320 hoặc gate publish.
