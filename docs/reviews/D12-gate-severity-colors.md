# D12 — Gate scan severity colors — review (reviewer-merged, James)

SHA: `e1dbec9d2f85b7282c4952e41a5b3dae6ce3081f` (fix commit, re-reviewed on top of `5e94e7cb`; base `67da5c55`). Scope: `apps/mobile/src/gate/*`, `apps/mobile/src/theme/{colors.ts,tokens.generated.ts,tokens.test.ts}`, `apps/mobile/scripts/sync-tokens.mjs`.

**Tóm tắt:** Logic đổi màu đúng cho `gate-outcome-copy.ts`/`gate-scan-status-ui.ts`/`staff-gate-scan-status.tsx`/`staff-gate-device-history-panel.tsx` và `colors.ts` (AC1–AC4 pass). F1 (toast thiếu nhánh `warning`) đã được fix tại `e1dbec9d` và xác nhận đúng.

**Verdict:** DoD = PASS (F1 fixed, re-validated at `e1dbec9d`). UI/token correctness (AC1–AC3, tokens.generated/sync-tokens) = PASS. F2 và UAT/simulator screenshot vẫn là known gap, không chặn.

**Checks (re-run tại `e1dbec9d`):** `pnpm --filter mobile test` → 553 pass/0 fail; `pnpm --filter mobile typecheck` → clean; diff `5e94e7cb..e1dbec9d` trên `staff-gate-scan-toast.tsx` xác nhận đúng 1 dòng thêm `if (tone === 'warning') return colors.warning;` trước nhánh `unknown`, khớp đề xuất gốc, không có thay đổi ngoài phạm vi F1.

**Findings:**
- F1 (đã fix, AC2): `apps/mobile/src/gate/staff-gate-scan-toast.tsx:14` — đã thêm `if (tone === 'warning') return colors.warning;`. Đã xác nhận bằng đọc source tại `e1dbec9d` (nhánh warning đứng trước `unknown`, đúng thứ tự như `staff-gate-scan-status.tsx`) và rerun test+typecheck sạch. Toast tại `screens/staff-scan.tsx:96` giờ hiển thị amber cho vé đã check-in đúng AC2. Không có test riêng cho component này (vẫn là gap nhẹ, không chặn vì fix là 1-line mirror của pattern đã test ở `staff-gate-scan-status.tsx`).
- F2 (non-blocking, out of current AC scope): `staff-gate-chrome.tsx` (`gateOutcomeGlyph`, `OutcomeGlyph`) và `staff-gate-ops-sticky.tsx` (`StatusIconInfo['tone']`) vẫn dùng type tone cũ không có `warning`; `gateOutcomeGlyph` hiện không có call site nào (dead code) nên không chặn, nhưng nếu được tái sử dụng sau sẽ lặp lại lỗi F1.

**Limitations / bước tiếp:** Chưa có UAT/emulator screenshot cho 3 tone (deny/warning/unknown) trên simulator — coi là known gap, cần staff-scan simulator capture trước khi đóng Epic, không chặn riêng PR này. Sau khi fix F1, cần reviewer re-pass nhanh trên file đó.
