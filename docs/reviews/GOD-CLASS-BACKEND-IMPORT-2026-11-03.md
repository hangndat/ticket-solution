# Review: god-backend-import-review — import CSV extraction (DoD + Security)

- Reviewer: James (`reviewer-merged`, gate `dod+sec`), session `8fb43033-1741-497f-9819-d18108b88745`, độc lập với implementer coordinator Minh.
- Scope: `packages/backend/package.json`, `packages/backend/src/import-jobs.ts`, `packages/backend/src/import-csv.ts`, `packages/backend/test/import-csv.test.cjs`.
- Exact SHA: `1175c090178f85aea2f3123911fb8f32623b4bf3`, base `1e383442070c1873fce64b6601869658ba63b42d`, worktree `/Users/admin/SideProject/ticket-solution/god-backend-import-review` (HEAD xác nhận khớp SHA).
- CRG: `list_graph_stats_tool` (0 nodes) → `build_or_update_graph_tool` full build tại đúng HEAD → `detect_changes_tool` + `get_affected_flows_tool` xác nhận 4 file thay đổi, 8 flow ảnh hưởng (`previewImportJob`, `commitImportJob`, `uploadImportFile`, `createImportJob`, `listImportJobs`, `getImportJob`, `downloadImportErrors`, `cleanupExpiredImportFiles`).

## Checks (trên exact SHA)

| Check | Lệnh | Kết quả |
| --- | --- | --- |
| Backend build + unit test | `pnpm --filter @ticket/contracts build && pnpm test` (packages/backend) | 61/61 PASS |
| Import-list integration | `pnpm test:import-list` | 1/1 PASS (H-I1/H-I2/H-I3) |
| Lint | `pnpm lint` (eslint src) | 0 errors |
| Prettier scoped | `npx prettier --check` trên 4 path đổi | All matched files use Prettier code style |
| Diff check | `git diff base..SHA` 4 file, so với code gốc trong `import-jobs.ts` trước khi xoá | Khớp byte-for-byte (pure move) |

## Phân tích diff

`import-csv.ts` là module mới, chứa nguyên văn các hàm bị xoá khỏi `import-jobs.ts`: `assertUtf8Csv`, `parseCsvRows`, `defaultMapping`, `normalizeMapping`, `headerIndex`, `canonicalizeEmail`, `isValidEmail`, `maskCodeHint`, type `ValidParsedRow`/`ParseResult`, `parsePayload`. So sánh trực tiếp nội dung hàm trước/sau: **không đổi một dòng logic nào** — chỉ export thêm `assertUtf8Csv`, `normalizeMapping`, `parsePayload`, `ValidParsedRow` để `import-jobs.ts` import lại. `import-jobs.ts` chỉ đổi import block (`toCsvRow` từ `csv-guard` giữ nguyên, thêm import từ `./import-csv`); không có dòng nào khác trong `import-jobs.ts` bị sửa — nghĩa là mọi call site (`previewImportJob`, `commitImportJob`, `uploadImportFile`, `createImportJob`) gọi các hàm này với cùng tham số, cùng vị trí trong transaction/`withTenant`/`requireTenantPermission`/`lockEvent`/quota (`rowLimitForTenant`, `readEventRemainingQuota`) như trước khi tách. `package.json` chỉ thêm `test/import-csv.test.cjs` vào script `test`.

Kết luận: đây là tách module thuần (god-class decomposition), không có thay đổi hành vi public API, DB/tenant/RLS, quota, hay preview/commit.

## Nguyên nghĩa các bất biến được kiểm

- **UTF-8 validation / UTF-16 BOM reject** (`assertUtf8Csv`): logic giữ nguyên; test mới `import CSV rejects malformed bytes before preview or commit` phủ cả UTF-16 BOM và byte UTF-8 không hợp lệ.
- **Quoted CSV parsing** (`parseCsvRows`, không export, chỉ dùng nội bộ qua `parsePayload`): test `code preview parses quoted delimiters...` xác nhận `"ab,cd"` được parse thành 1 cell đúng dấu phẩy trong quote.
- **Mapping GUESTS/CODES** (`normalizeMapping`): cross-kind mapping (`email` cho CODES, `code` cho GUESTS) vẫn reject với `IMPORT_FILE_INVALID`; test `row limit and cross-kind mapping fail...` phủ case này.
- **Duplicate email/code**: email dedupe theo `canonicalizeEmail` (lowercase+trim), code dedupe theo `toUpperCase`; cả hai đúng hành vi cũ, có test riêng.
- **Masking lỗi trong error CSV — không leak email/code**:
  - Email: `errorCsv` cho dòng `DUPLICATE_IN_FILE` **không bao giờ** nối giá trị email thật vào message (chỉ `fieldId`, `code`, message tĩnh) — test `assert.doesNotMatch(parsed.errorCsv, /alice@example\.com/i)` xác nhận.
  - Code: `maskCodeHint` chỉ giữ ký tự đầu + `***` khi length>2, hoặc `**` khi ≤2; test `assert.doesNotMatch(parsed.errorCsv, /AB,CD/)` + `assert.match(parsed.errorCsv, /A\*\*\*/)` xác nhận code gốc không xuất hiện trong report lỗi.
- **maxRows**: `parsePayload` vẫn throw `IMPORT_ROW_LIMIT` khi `dataRows.length > maxRows`, kiểm tra **trước** khi ghi import job (gọi từ `createImportJob`/`previewImportJob` sau `rowLimitForTenant`); test `row limit...` phủ trực tiếp hàm.
- **Public import API / DB / tenant / RLS / quota / preview-commit**: không path nào trong `import-jobs.ts` đổi ngoài import block — `withTenant`, `requireTenantPermission`, `lockEvent`, idempotency key, quota check (`readEventRemainingQuota`, `rowLimitForTenant`) giữ nguyên vị trí gọi; test tích hợp `test:import-list` (H-I1/H-I2/H-I3, chạy qua import job thật + invitations + attendee claim) PASS trên exact SHA xác nhận hành vi end-to-end không hồi quy.

CRG `detect_changes_tool` báo "test gap: none" cho các hàm vì công cụ không resolve edge `TESTED_BY` qua `require('../dist/...')` trong file `.cjs`; xác minh thủ công cho thấy `import-csv.test.cjs` phủ đủ 4 unit hàm quan trọng (`assertUtf8Csv`, `normalizeMapping`, `parsePayload` và gián tiếp `parseCsvRows`/`maskCodeHint`/`canonicalizeEmail`/`isValidEmail`/`headerIndex` qua `parsePayload`). Không coi test exit 0 là nghiệm thu duy nhất — đã đối chiếu nội dung assertion với từng bất biến ở trên.

## Findings

Không có finding blocker hoặc should-fix. Đây là refactor thuần (move), hành vi và test giữ nguyên nghĩa.

## Verdict

- **DoD: PASS** — scope đúng 4 path, build/test/lint/prettier sạch trên exact SHA, hành vi public API/preview/commit không đổi (xác nhận bằng diff + test tích hợp).
- **Security: PASS** — không leak email/code trong error CSV (test xác nhận), tenant/RLS/quota/idempotency path không đổi, không chạm secrets/dependency mới (chỉ thêm 1 dòng script test).
