# HTTP integration — trạng thái 28/10/2026

GATE-01 bổ sung mở lại cùng cổng và đối soát PostgreSQL dưới runtime role/tenant RLS sau các nhánh deny; actor có assignment ở cả hai event vẫn thiếu. Kết quả exact SHA và run ID của lần chạy mới được bàn giao riêng; selector con không chứng minh toàn bộ ID.

Đã viết runner Node `--list`/`--case` và năm ca H vào HTTPS API với JWT từ Keycloak thật. Source assertion lấy từ `apps/api/src/{tickets,gate,reporting}.ts`, `packages/backend/src/{issue,gate,reporting}.ts`; không giả auth, không gọi Playwright.

**Runtime:** Chưa chạy; coordinator cần manifest và isolated stack. `node --check` hai file PASS; `--list` liệt kê đủ năm ID, `--case DB-03 --list` chọn đúng một ID; `coverage.json` parse PASS. Không có `E2E_MANIFEST`, runner thoát mã 2 với `BLOCKED`, không skip. Những kiểm tra này không là HTTP PASS. `coverage.json` giữ `blocked` cho full AC, kể cả khi các nhánh H này PASS.

Giới hạn cụ thể: SEC-01 thiếu matrix mọi resource; AUTH-03 thiếu browser UX và lookup/confirm; GATE-01 thiếu reopen same gate và actor assigned cả hai event; GATE-03 không có HTTP QR parser và chưa test revoked/cancelled; DB-03 thiếu concurrency nhiều actor, source counter, audit/outbox đối soát.

Chạy: `node tests/e2e/http/entry.mjs --list`; với manifest: `E2E_MANIFEST=<private-path> NODE_EXTRA_CA_CERTS=<cert-path> NODE_OPTIONS='--require <dns-preload>' node tests/e2e/http/entry.mjs [--case DB-03]`.
