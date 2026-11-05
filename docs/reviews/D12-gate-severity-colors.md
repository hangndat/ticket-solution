# D12 — Gate scan severity colors — review (reviewer-merged, James)

SHA: `5e94e7cb1e5a4f27df71aab1affe772b6a5cf07b` (base `67da5c55`). Scope: `apps/mobile/src/gate/*`, `apps/mobile/src/theme/{colors.ts,tokens.generated.ts,tokens.test.ts}`, `apps/mobile/scripts/sync-tokens.mjs`.

**Tóm tắt:** Logic đổi màu đúng cho `gate-outcome-copy.ts`/`gate-scan-status-ui.ts`/`staff-gate-scan-status.tsx`/`staff-gate-device-history-panel.tsx` và `colors.ts` (AC1–AC4 pass), nhưng `staff-gate-device-history.ts`/`staff-gate-scan-toast.tsx` thiếu nhánh `warning` nên toast quét trực tiếp (màn `staff-scan`) hiển thị `colors.label` (gần đen) thay vì amber cho vé đã check-in — **blocking**.

**Verdict:** DoD = GAP (bug F1 dưới). UI/token correctness (AC1–AC3, tokens.generated/sync-tokens) = PASS.

**Checks:** rerun `pnpm --filter mobile test` tại head SHA → 553 pass/0 fail (khớp report worker); rerun `pnpm --filter mobile typecheck` → clean (TS không bắt được vì toneColor dùng if/else không exhaustive, không phải switch kiểu).

**Findings:**
- F1 (blocking, AC2): `apps/mobile/src/gate/staff-gate-scan-toast.tsx:11-15` — `toneColor()` chỉ xử lý `admit`/`deny`/`unknown`, thiếu `tone === 'warning'`. `GateScanStatusView.tone` cho `already-checked-in` nay là `'warning'` (gate-scan-status-ui.ts:132) nên rơi xuống default `colors.label` (brand.ink, gần đen) — không phải đỏ, không phải amber. Toast này được dùng trực tiếp ở `screens/staff-scan.tsx:96`, là feedback chính khi staff quét. Bằng chứng: đọc source + searched 0 nhánh `warning` trong file; không có test file riêng cho component này nên 553/553 không bắt lỗi. Điều kiện đóng: thêm `if (tone === 'warning') return colors.warning;` trước nhánh unknown, kèm test tối thiểu cho tone mapping.
- F2 (non-blocking, out of current AC scope): `staff-gate-chrome.tsx` (`gateOutcomeGlyph`, `OutcomeGlyph`) và `staff-gate-ops-sticky.tsx` (`StatusIconInfo['tone']`) vẫn dùng type tone cũ không có `warning`; `gateOutcomeGlyph` hiện không có call site nào (dead code) nên không chặn, nhưng nếu được tái sử dụng sau sẽ lặp lại lỗi F1.

**Limitations / bước tiếp:** Chưa có UAT/emulator screenshot cho 3 tone (deny/warning/unknown) trên simulator — coi là known gap, cần staff-scan simulator capture trước khi đóng Epic, không chặn riêng PR này. Sau khi fix F1, cần reviewer re-pass nhanh trên file đó.
