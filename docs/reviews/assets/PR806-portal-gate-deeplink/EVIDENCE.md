# #806 portal gate deeplink removal — UI evidence

**Limitation:** Không có cred Keycloak UAT trong session worker; không chạy portal dev đăng nhập end-to-end.

**Thay thế:** Component `GateIosScanHint` + `GateStayAppNotice` (VI) render qua static fixture; trang báo cáo gate (`/t/.../gate`) giữ nguyên KPI — xác nhận bằng `ops-report.test.ts` route path.

**Grep `/gate` (sau thay đổi):** chỉ `allowlist.ts` (chặn), `capabilities.ts` (nav báo cáo nội bộ `/t/.../gate`), route `app/.../gate/page.tsx`, link nội bộ event overview → gate report.

**Checks local:** `pnpm --filter @ticket/portal typegen` + `pnpm exec turbo run lint typecheck test build --filter=@ticket/portal...` — pass trước commit PR.

**Screenshot:** `fixture-gate-hint-vi.html` mô phỏng header hint + trang báo cáo (copy VI). Playwright browser chưa cài trên worker (`npx playwright install` thiếu) — PNG chưa export; reviewer có thể mở fixture 1280px hoặc portal dev sau login.
