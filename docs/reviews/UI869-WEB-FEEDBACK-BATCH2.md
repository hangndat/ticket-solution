# UI869 feedback batch 2/2 — web (implementer only, no independent review yet)

- Branch `hangndat/ui867-web-simplify`; base head khi nhận việc **`30ce1daa60572f6309305436ff9aa29a17ccebe1`** (PR #870, Task #869). Chưa commit/push — diff còn ở working tree, root integration sau handoff.
- Scope: `apps/web` only. Không sửa `packages/ui`, auth contracts, backend, root scripts.
- Checks trên head hiện tại: `pnpm --filter @ticket/web lint` PASS, `typecheck` PASS, `test` 286/286 PASS, `build` PASS, `node scripts/ui-budget.mjs` PASS (không đổi metric nào).

## Files changed (working tree, chưa commit)

| File | Thay đổi |
| --- | --- |
| `apps/web/src/attendee-surface.ts` | (đã có từ trước phiên này — giữ nguyên, không đụng) padding/text-center cho empty state |
| `apps/web/src/home-catalog/home-catalog-grid.tsx` | Wire nút "Xóa bộ lọc" vào empty state khi có query/filter active (AC5) |
| `apps/web/app/globals.css` | `scroll-behavior: smooth` scoped `html[data-surface='marketing']` + `prefers-reduced-motion: reduce` override (AC4) |
| `apps/web/src/marketing/marketing-surface.ts` | `scroll-mt-24` trên `sectionPad` (dùng chung bởi mọi section có anchor: features/how_it_works/solutions/faq/interest) để bù sticky header 72px (AC4) |
| `apps/web/src/marketing/interest-form.tsx` | 4 `<select>` + 1 `<textarea>` trước đây hoàn toàn không style (0 border/radius/focus) → áp `controlClass()` khớp `Input` primitive (AC3) |
| `apps/web/src/redeem/redeem-surface.ts` | `devFormFieldChrome` (dùng bởi claim/invite/account/redeem forms qua `claimFormRoot`/`accountDeletionFormRoot`/`redeemDevFormRoot`/`redeemProductFormRoot`) thêm `rounded-md`, `focus-visible` ring khớp token `--color-focus`, `disabled:opacity-50`, `aria-invalid:border-destructive`; `redeemVersionsGrid` tương tự (AC3) |
| `apps/web/src/ui/control-classes.ts` (mới) | Helper `controlClass(error?)` tái dùng `inputVariants` export từ `@ticket/ui` (không sửa `packages/ui`) cho `<select>`/`<textarea>` chưa có component dùng chung |

## AC-by-AC

**(1) Locale switch ổn định, không layout shift, preserve hash** — ĐÃ ĐÚNG SẴN, không cần sửa code; verify bằng Orca browser:
- `LocaleSwitch` giữ hash qua `useSyncExternalStore` + `localeSwitchHref` — không mất `#interest` khi đổi VI/EN (đọc code, không có browser phiên đăng ký form nên chưa click-through).
- Đo `getBoundingClientRect()` header/hero tại 390: VI `header=72px hero=883.02px`, EN `header=72px hero=883.02px` — **giống hệt**. Tại 1440: screenshot VI/EN (`ui869-mkt-vi-1440.png` / `ui869-mkt-en-1440.png`) — nav/header/hero cùng vị trí pixel, badge VI/EN cùng kích thước `min-h-9 min-w-9`.
- Không kiểm 1024 bằng ảnh (chỉ đo height qua eval, kết quả nhất quán ~880px) — gap nhỏ, không phải bug mới.

**(2) Ảnh chụp sản phẩm thật thay mockup** — **CHƯA LÀM — honest gap, không giả.**
- `ProductPreviewFrame` là component trong `packages/ui` (ngoài scope worker này — root sở hữu). Usage ở `apps/web/src/marketing/sections/hero.tsx:84` có thể thay, nhưng thay bằng gì đòi evidence ảnh chụp thật có provenance (không mockup/mkt asset thiết kế, không AI image) — chưa có asset nào như vậy trong repo; root đang chuẩn bị local API/OIDC/data đầy đủ theo checkpoint coordinator gửi lúc 08:25 UTC. Không tự tạo/chụp giả để lấp AC này.
- `bento.tsx` cũng dùng ảnh `public/marketing/bento-*.webp` — chưa xác minh provenance (synthetic design asset hay screenshot thật); không đổi vì chưa có hướng dẫn asset thay thế.
- Đề xuất: chờ root cấp API/OIDC + banner redesign PD doc (`docs/design/UI869-FEEDBACK` đang được viết) trước khi động vào media, đúng chỉ đạo "chờ trước banner edit" từ checkpoint.

**(3) Input/search/select/textarea thống nhất height/border/radius/focus/disabled/error** — ĐÃ SỬA phần lớn:
- Marketing interest form: 4 select + 1 textarea trước đây 0 style → giờ khớp `Input` (`min-h-11 rounded-md border bg-white focus-visible:ring-focus`).
- Redeem/claim/invite/account forms (`devFormFieldChrome`): thêm `rounded-md` (trước đây vuông góc, khác `Input`/`redeemCodeField` bo tròn), thêm `focus-visible:ring` (trước đây KHÔNG có focus ring nào — chỉ dựa outline mặc định browser, có thể bị Preflight reset mất), thêm `disabled:opacity-50`, thêm `aria-invalid:border-destructive`. Một edit tại `devFormFieldChrome` cascade sang claim-form/invite-accept/account-panel/redeem-form vì tất cả dùng chung class gốc này.
- Chưa verify bằng screenshot thật (các form này cần auth/invite token mà local chưa có fixture — theo giới hạn đã biết từ UI867-WEB-DELIVERY.md mục "Giới hạn phải giữ mở" #1). Đã verify bằng lint/typecheck/test PASS + đọc source.
- `home-catalog-grid.tsx` search input + time-filter select: đã đúng từ trước (có `rounded-md border-line focus:border-focus`).

**(4) Section nav anchor scroll mượt, sticky header offset, reduced motion, không hijack keyboard/history** — ĐÃ SỬA, verify qua Orca browser:
- Trước: không `scroll-behavior`, không `scroll-margin-top` → click "Tính năng"/"FAQ" nhảy tức thì (instant jump) và heading nằm đúng dưới sticky header 72px (bị che).
- Sau: `scroll-smooth` (scoped `[data-surface=marketing]`, có `motion-reduce:` override, không đụng consumer app) + `scroll-mt-24` trên mọi section anchor.
- Verify: click `#faq` nav link bằng Orca browser (`agent-browser` qua `orca exec`), đo `document.getElementById('faq').getBoundingClientRect().top` sau khi cuộn ổn định = **95.93px** (header 72px + 24px clearance) — không overlap. URL hash cập nhật đúng (`#faq`), không can thiệp History API ngoài hành vi `<a href="#...">` gốc của browser — không hijack.
- Không sửa keyboard nav/focus order — chỉ CSS.

**(5) Empty state catalog bị bó dải một dòng, thiếu action reset filter** — ĐÃ SỬA (tiếp tục diff có sẵn từ phiên trước):
- `attendeeHomeCatalogEmpty` đã có padding/`text-center`/`grid gap-3` từ trước (uncommitted diff lúc nhận việc, giữ nguyên).
- Bổ sung: nút "Xóa bộ lọc" (`Button variant="secondary"`) hiện khi `query` hoặc `timeFilter !== 'upcoming'` đang active, reset cả hai về mặc định. `data-testid="home-catalog-empty-reset"`.
- Chưa chụp ảnh evidence runtime (cần data catalog rỗng theo filter cụ thể qua proxy public-read — không ép filter giả để tạo trạng thái rỗng nhân tạo ngoài scope UAT đã duyệt).

**(6) Bỏ trang đệm loading xấu, dùng skeleton đúng bố cục, tránh spinner fullscreen/flash** — RÀ SOÁT, KHÔNG SỬA THÊM:
- `app/loading.tsx` (root) đã dùng `CatalogSkeletonGrid` + `SurfaceState kind="loading"` giữ header/nav — đúng pattern mong muốn, không phải spinner fullscreen.
- Không tìm thấy `loading.tsx` nào khác trong `app/` (marketing, redeem, consumer con không có loading.tsx riêng) — mọi route dùng chung root loading.tsx của catalog. Trong lúc dev-server cold-compile, quan sát được 1 lần marketing `/en` và `/` hiển thị tạm skeleton catalog tiếng Việt (text "Đang tải…" + copy catalog) trước khi hydrate xong — **không tái hiện ổn định sau reload, nghi là dev-compile artifact (Next dev Fast Refresh), không khẳng định là bug production**. Ghi nhận làm finding mở, chưa sửa: nếu marketing cần skeleton riêng (không dùng copy "danh sách sự kiện" cho trang sales), cần `app/marketing/loading.tsx` riêng — out of scope batch này vì chưa có hướng dẫn thiết kế skeleton marketing cụ thể và rủi ro đụng vào banner đang chờ PD doc.

**(7) CatalogEventCard height / `HomeCatalogGrid`** — theo checkpoint coordinator: root đã sửa `flex-stretch/h-full/content flex-1/CTA mt-auto` trong `packages/ui`. Không sửa thêm trong `packages/ui`. `attendeeHomeCatalogGrid` (`apps/web/src/attendee-surface.ts`) chỉ là `grid grid-cols-1 gap-[22px] sm:grid-cols-2 xl:grid-cols-3` — không cần `h-full` ở layer grid vì card tự quản chiều cao qua CSS grid row stretch mặc định (`align-items: stretch` default); không phát hiện cần sửa thêm phía web. Chưa chụp ảnh so sánh grid 3 cột sau fix root (cần redeploy packages/ui build trước khi xem trong preview này).

## Evidence

- `apps/web/.uat-artifacts/UI869-FEEDBACK/` (gitignored): `ui869-mkt-vi-390.png`, `ui869-mkt-vi-1440.png`, `ui869-mkt-en-1440.png`, `ui869-anchor-features-1440-v2.png`, `ui869-anchor-faq-1440-v2.png`.
- Lệnh Orca dùng: `orca tab create --url <baseUrl> --worktree active --json`, `orca exec --command "set viewport <w> <h>" --page <id> --json`, `... "open <url>"`, `... "eval (()=>{...})()"` (dùng backtick thay cho quote — `orca exec --command` strip cả `'` lẫn `"`), `... "screenshot <path>"`, `... "click @eNN"`. Đã `orca tab close` cả 2 tab tự mở sau khi xong; không đụng 2 tab có sẵn (`127.0.0.1:3417/` và `localhost:3417/` index 0–1, không phải của worker này).
- Ghi chú tooling: `screenshot` dường như luôn chụp từ scroll-top bất kể `scrollY` hiện tại (đã xác nhận qua `window.scrollY` khác 0 nhưng ảnh vẫn hiện hero) — verify vị trí anchor dùng `getBoundingClientRect()` thay vì ảnh.

## Chưa làm / honest gap

1. **Media thật (AC2)** — block hoàn toàn, chờ root cấp asset có provenance + PD banner doc.
2. Screenshot evidence cho AC3 (auth-gated forms) và AC5 (empty state thực tế) — thiếu fixture/data để tạo trạng thái runtime, không ép giả.
3. AC6 — chỉ audit, chưa tạo `loading.tsx` riêng cho marketing; cần quyết định thiết kế skeleton trước khi làm.
4. Chưa authenticated redeem/account/wallet UAT (giới hạn cũ từ UI867-WEB-DELIVERY.md vẫn còn mở).
5. Không chạy review độc lập — theo task, worker này chỉ implement; reviewer ≠ implementer theo rule repo.

Không spawn subagent. Không commit/push — chờ coordinator gom batch trước khi tạo commit.
