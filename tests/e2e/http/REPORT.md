# HTTP integration — trạng thái 28/10/2026

## DB-15 / DB-16 — Issue #1030

Diagnostic `mvxkyku6-2a175b` PASS 2/2 qua HTTPS API và Keycloak thật trên stack cô lập, nhưng worktree đang sửa nên không dùng làm evidence exact SHA. DB-15 đối soát report sau confirm/reject/undo/cancel và kiểm check-in/audit PG; notification UNKNOWN/DEAD là fixture PG, còn retry provider tới DEAD được chạy ở D. DB-16 kiểm Owner/Manager assignment, cursor/limit/watermark và cross-tenant deny; snapshot digest PG dưới tenant RLS không đổi qua các request deny. Chờ chạy lại trên commit sạch và review độc lập; câu chữ O12 về APPLIED và cách loại undo cần làm rõ riêng như trong báo cáo backend.

Đã viết runner Node `--list`/`--case` và năm ca H vào HTTPS API với JWT từ Keycloak thật. Source assertion lấy từ `apps/api/src/{tickets,gate,reporting}.ts`, `packages/backend/src/{issue,gate,reporting}.ts`; không giả auth, không gọi Playwright.

**Runtime:** Chưa chạy; coordinator cần manifest và isolated stack. `node --check` hai file PASS; `--list` liệt kê đủ năm ID, `--case DB-03 --list` chọn đúng một ID; `coverage.json` parse PASS. Không có `E2E_MANIFEST`, runner thoát mã 2 với `BLOCKED`, không skip. Những kiểm tra này không là HTTP PASS. `coverage.json` giữ `blocked` cho full AC, kể cả khi các nhánh H này PASS.

Giới hạn cụ thể: SEC-01 thiếu matrix mọi resource; AUTH-03 thiếu browser UX và lookup/confirm; GATE-01 thiếu reopen same gate và actor assigned cả hai event; GATE-03 không có HTTP QR parser và chưa test revoked/cancelled; DB-03 thiếu concurrency nhiều actor, source counter, audit/outbox đối soát.

Chạy: `node tests/e2e/http/entry.mjs --list`; với manifest: `E2E_MANIFEST=<private-path> NODE_EXTRA_CA_CERTS=<cert-path> NODE_OPTIONS='--require <dns-preload>' node tests/e2e/http/entry.mjs [--case DB-03]`.

## GATE-03 signed credential — 02/11/2026

Run `mvyisdk6-156618` trả `PASS` 1/1 cho selector HTTP trên source SHA `989e68394ac6a301f26c47a519264c05e5e105da`. Harness dựng stack cô lập thật với Keycloak, PostgreSQL và API; summary và log ở `tests/e2e/.artifacts/mvyisdk6-156618/`.

Ca lấy JWS ES256 và mã manual qua `/me/tickets/:ticketId`, sau đó kiểm reserve/confirm hợp lệ, chữ ký bị sửa, context sai event và signed context sai tenant, version cũ, vé revoke, vé đã dùng, manual lookup và proof token dùng từ staff session khác. Các request từ chối kiểm tra reservation/check-in bất biến; các nhánh credential deny có `gate.reject` trong tenant tương ứng dưới RLS. Signing key ephemeral được tạo cho run; private key chỉ được seal bằng helper backend hiện có.

Không nâng GATE-03 thành PASS toàn phần. Summary ghi `evidenceExactShaEligible: false` / `NON_EVIDENCE_DIRTY` vì worktree vẫn có `company/work-events.jsonl` cùng sáu báo cáo James đã tồn tại trước task; các file được giữ nguyên. Ma trận còn thiếu audience/kid/alg/hash, ticket cancelled, manual code/proof invalid, proof expiry/version stale và rate-limit. `coverage.json` vẫn giữ trạng thái `blocked`.

CRG scope: repo `/Users/admin/SideProject/ticket-solution/f04-port09-unknown-contract`; stats và `file_summary(tests/e2e/http/live.test.mjs)` đã chạy tại source SHA `989e68394ac6a301f26c47a519264c05e5e105da`. Tip `d066abbd` chỉ thêm báo cáo/coverage, không đổi source; MCP graph giữ `head_matches_build=false` cho phần docs-only.
