# Kiểm manifest E2E

- `validateManifest(value, { requiredCaseIds, runDir })` kiểm schema v1, run ID, HTTPS origins theo `e2e-${runId}.test`, Mailpit loopback có port, fixture và actor credentials. Hàm trả chính object đầu vào, không ghi hoặc in manifest.
- Khi truyền `runDir`, kiểm đường dẫn khai báo nằm trong run; đây là kiểm đường dẫn theo chuỗi, chưa xác minh symlink hoặc quyền sở hữu tài nguyên. Coordinator cần gọi validator trước khi mở browser/API và vẫn kiểm ownership lúc cleanup.
- Lệnh đã chạy: `pnpm exec node --test tests/e2e/validation/validate.test.mjs` — 7/7 pass. Không chạy browser/runtime cho nhóm validation.
- `tests/e2e/PLAN.md` mô tả host dạng `app.<runId>.e2e.test`, còn runtime hiện tại tạo `app.e2e-${runId}.test`. Validator theo runtime và Task Spec; coordinator nên đồng bộ plan khi tích hợp.
