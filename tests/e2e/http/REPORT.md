# HTTP integration — trạng thái 28/10/2026

## DB-15 / DB-16 — Issue #1030

Diagnostic `mvxkyku6-2a175b` PASS 2/2 qua HTTPS API và Keycloak thật trên stack cô lập, nhưng worktree đang sửa nên không dùng làm evidence exact SHA. DB-15 đối soát report sau confirm/reject/undo/cancel và kiểm check-in/audit PG; notification UNKNOWN/DEAD là fixture PG, còn retry provider tới DEAD được chạy ở D. DB-16 kiểm Owner/Manager assignment, cursor/limit/watermark và cross-tenant deny; snapshot digest PG dưới tenant RLS không đổi qua các request deny. Chờ chạy lại trên commit sạch và review độc lập; câu chữ O12 về APPLIED và cách loại undo cần làm rõ riêng như trong báo cáo backend.

Đã viết runner Node `--list`/`--case` và năm ca H vào HTTPS API với JWT từ Keycloak thật. Source assertion lấy từ `apps/api/src/{tickets,gate,reporting}.ts`, `packages/backend/src/{issue,gate,reporting}.ts`; không giả auth, không gọi Playwright.

**Runtime:** Chưa chạy; coordinator cần manifest và isolated stack. `node --check` hai file PASS; `--list` liệt kê đủ năm ID, `--case DB-03 --list` chọn đúng một ID; `coverage.json` parse PASS. Không có `E2E_MANIFEST`, runner thoát mã 2 với `BLOCKED`, không skip. Những kiểm tra này không là HTTP PASS. `coverage.json` giữ `blocked` cho full AC, kể cả khi các nhánh H này PASS.

Giới hạn cụ thể: SEC-01 thiếu matrix mọi resource; AUTH-03 thiếu browser UX và lookup/confirm; GATE-01 thiếu reopen same gate và actor assigned cả hai event; GATE-03 không có HTTP QR parser và chưa test revoked/cancelled; DB-03 thiếu concurrency nhiều actor, source counter, audit/outbox đối soát.

Chạy: `node tests/e2e/http/entry.mjs --list`; với manifest: `E2E_MANIFEST=<private-path> NODE_EXTRA_CA_CERTS=<cert-path> NODE_OPTIONS='--require <dns-preload>' node tests/e2e/http/entry.mjs [--case DB-03]`.

## DB-19 — inventory assertion theo PLAN §6.1

| AC | Assertion hiện có | Còn thiếu |
| --- | --- | --- |
| Pepper v1 còn hỗ trợ, v2 là current | D `db19-code-pepper-rotation.test.cjs`: lookup code v1 sau rotate; H `[DB-19]`: bearer Keycloak redeem v1 và v2 qua API thật, ticket/outbox/quota tăng đúng hai | Không |
| Version bỏ khỏi ring fail-closed | D bỏ v1 khỏi ring → `CODE_INVALID`; H code v3 ngoài ring → `422 CODE_INVALID`, snapshot code/ticket/outbox/quota không đổi | Không |
| Trùng raw code qua hai pepper fail-closed; code đã dùng không sống lại | D selector duplicate rows và consumed; H v1/v2 digest trùng → `CODE_INVALID`, consumed → `CODE_CONSUMED`, snapshot không đổi | Không |
| Không lộ material | D kiểm DB chỉ giữ HMAC/version; H kiểm digest khác raw code và không có pepper/credential key trong API response/log của run | Không chứng minh mọi kênh telemetry ngoài run local |
| QR credential key cũ, revoked | Chưa có versioned credential keyring: `kid` cố định `local-v1`; trạng thái `REVOKED` của credential được kiểm riêng trong DB-09 | Owner cần chốt giữ DB-19 AC và thiết kế keyring, hoặc điều chỉnh AC QR có ghi rủi ro theo PLAN §15.2 |

Chạy H riêng bằng `E2E_LANES=1 pnpm test:e2e:http --lane --case=DB-19`; fixture v2 current/v1 legacy được cô lập, nên không ghép ID này với các HTTP case dùng cấu hình pepper mặc định. Kết quả exact SHA và verdict ghi ở báo cáo bàn giao, không đổi `ACCEPTANCE.md` trong Task này.
