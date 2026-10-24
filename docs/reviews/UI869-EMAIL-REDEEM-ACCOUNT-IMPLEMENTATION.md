# #869 — Handoff F07–F09 (web)

- Role: Linh / `web`; architecture impact: Không. Baseline và HEAD chưa commit: `109e0c59066498071f95fdf6e4851f2d4f6af6d9`. Chỉ sửa `apps/web/**`; file này là handoff theo Task. Worktree còn dirty từ coordinator ở `company/`, `scripts/`, `docs/`; không nhận ownership các path đó.
- Không sửa F01. Bộ đếm review/fix 2/2 + ngoại lệ đã dùng giữ nguyên. Chưa commit/push.

## Phạm vi đã làm

| AC | Paths | Kết quả |
| --- | --- | --- |
| F07 | `src/nav/capabilities.ts`, `src/guest/claim-intent.ts`, `app/(consumer)/claim/{page,claim-form}.tsx`, `src/redeem/published-schema.ts`, tests | Bỏ `/claim` khỏi guest/auth nav; màn thiếu link chỉ hướng về email, Đổi mã/Vé. Fragment mới không ghép token/scope với parked intent cũ; đầy đủ token, IDs, slugs mới park qua `sessionStorage`, xóa hash; tự tải schema public và đối chiếu cả tenant/event IDs cùng terms trước khi hiện submit. Hiện tên sự kiện/tổ chức public nếu API có, không render token/UUID/slug input. Giữ form/terms validation, idempotency theo invitation, email verified/matching qua API và pending ≠ issued. 403 wrong-email đi qua decoder denial thay vì bị gộp vào login. |
| F08 | `app/(consumer)/redeem/redeem-form.tsx` | Form thật có grid gap 16px; heading “Nhập mã đổi vé”, hướng dẫn bước sau, helper cho input, “Tiếp tục” và link “Vé của tôi”; không đổi resolver/issue API. |
| F09 | `app/(consumer)/account/{page,account-panel}.tsx`, `src/account/account-flow-surface.ts` | Một mục settings “Xóa tài khoản” mở phần giải thích/xác nhận; copy trước submit dùng thì tương lai, privacy link giữ chính sách 30/730 ngày. Checkbox nằm ngang, nút destructive chỉ enabled khi current đã load, chưa có request, đã confirm và không busy. Không đổi endpoint/CSRF/payload; success chỉ nói đã tiếp nhận, current/submitted tránh hai status panel cùng lúc. |

## Checks

- `pnpm --filter @ticket/web lint`: PASS.
- `pnpm --filter @ticket/web test`: PASS (0 fail, 0 skip).
- `pnpm --filter @ticket/web typecheck`: PASS.
- `pnpm --filter @ticket/web build`: PASS; warning cũ tại `src/marketing/lead/idempotency.ts` về dynamic filesystem trace, ngoài scope.
- `git diff --check -- apps/web`: PASS.
- `impeccable detect --json` trên 6 UI files đã đổi: `[]`.
- Tests có nghĩa: nav guest/auth không có `/claim`; fragment mới thiếu scope không ghép intent cũ; projection public hiển thị event/organization name.

## Orca UAT (local product `http://localhost:3417`, OIDC thật)

Không POST xóa tài khoản, claim lời mời hoặc issue mã; không dùng `DEMO-MFEST-002`. Tab do worker mở: `e3070364-2e15-459a-980a-0c0b12775058`, `dd5b0416-18cb-4734-83de-077553976592`, `8f987b44-e433-4d2b-a13a-499635f6607c`. Lệnh: `orca tab create`, `orca exec --command "set viewport 390 844"` / `"set viewport 1440 900"`, `orca snapshot`, `orca eval` (DOM kích thước và trạng thái), `orca screenshot`; fixture link mở bằng `node scripts/dev-local-invitation.cjs open` gọi Orca tab nội bộ. Không in/lưu raw URL/token trong report/log; `.local-dev/ui869/invitation.json` giữ mode 0600.

| Màn | Viewport/evidence trong `apps/web/.uat-artifacts/` | Kết quả |
| --- | --- | --- |
| `/redeem` ready | `ui869-redeem-390.png`, `ui869-redeem-1440.png` | Form computed gap 16px; 390/1440 document scrollWidth bằng viewport, không tràn. Chưa gọi resolve/issue. |
| `/account` signed in | `ui869-account-ready-390.png`, `ui869-account-confirmed-390.png`, `ui869-account-open-1440.png` | OIDC attendee fixture thật; current empty, checkbox focus-visible ring; unchecked button disabled, checked enabled, không click submit. 390 không tràn. Ảnh account-ready là trước khi đổi empty state từ khối xám sang một dòng gọn; source hiện tại đã sửa. |
| `/claim` trống | `ui869-claim-empty-390.png`, `ui869-claim-empty-1440.png` | Không token/scope input, không claim button, chỉ link Đổi mã/Vé; 390/1440 không tràn. |
| `/claim` link thật | `ui869-claim-valid-390.png`, `ui869-claim-valid-1440.png` | Fixture email thật mở trong Orca; hash được xóa, intent có trong sessionStorage, auto tải `MFest · Demo`/`MFest`, terms hiển thị; không input kỹ thuật, 390/1440 không tràn. Không POST claim nên không khẳng định issued. |

## Gap cần reviewer/coordinator biết

- OIDC return được thử một lần bằng link “Đăng nhập bằng email được mời”. Tab quay về `/claim`, `sessionStorage` vẫn có đủ 5 field intent nhưng Next dev giữ đồng thời loading fallback và SSR empty (`main` count 2), client chưa hydrate; không thể đánh PASS restore bằng DOM. Coordinator cho phép restart riêng web owned một lần. `python3 scripts/dev-local-process.py alive .local-dev/ui869/pid/web.pid` trả 0; `stop` đúng PID file rồi `bash scripts/dev-local-stack.sh up`; `localhost:3417/claim` và API `/v1/health` đều HTTP 200. Sau restart + reload, trạng thái hydration này vẫn tái hiện. Probe `/redeem` trên tab khác cũng có 2 `main` (loading fallback và form SSR), nên lỗi runtime này không riêng claim. Đây là khoảng trống UAT, không phải bằng chứng link context không được park (storage còn đủ); cần reviewer phân biệt runtime/dev server với lỗi client trước acceptance.
- Current invite fixture public `form:null`, terms có. UAT đã xem preview/schema; chưa xác minh nhánh có form fields hoặc POST claim. Không tự tạo fixture giả cho success.
- Ảnh account ready đã chụp trước sửa một dòng empty copy cuối; cần ảnh cuối nếu review pixel exact. Không có thay đổi chính sách hay API.

## Files dirty của worker

`apps/web/app/(consumer)/account/account-panel.tsx`, `page.tsx`; `apps/web/app/(consumer)/claim/claim-form.tsx`, `page.tsx`; `apps/web/app/(consumer)/redeem/redeem-form.tsx`; `apps/web/src/account/account-flow-surface.ts`; `apps/web/src/guest/claim-intent.ts`; `apps/web/src/nav/capabilities.ts`; `apps/web/src/redeem/published-schema.ts`; tests `guest-claim`, `nav-capabilities`, `nav-sec-cache`, `published-schema`.
