# UI869 / PR870 — feedback batch 2/2, phần còn mở sau ctx_0fad52aa691b (worker: Linh, web)

Tiếp nối `docs/reviews/UI869-WEB-FEEDBACK-BATCH2.md` — **không mở vòng sửa mới, không reset counter batch #869** (vẫn 2/2). Canonical thiết kế: `docs/design/UI869-FEEDBACK/README.md` (root APPROVED v2) + `prototype.html` + `assets/prototype-*.png` — override hoàn toàn `HANDOFF.md` cũ (sai). Base: `30ce1daa60572f6309305436ff9aa29a17ccebe1` (PR #870). Scope `apps/web` only — không sửa `packages/ui`, auth, backend, root tooling. **Chưa commit/push.**

## (1) Marketing hero redesign theo prototype

**Trước:** nền ink có `min-h-[min(82vh,46rem)]`, cột copy ép `max-md:min-h-[40rem] lg:min-h-[28rem]`, có eyebrow, 3 proof bullet, marquee cuộn vô hạn, CTA thứ 3 (login) là button `ghostOnInk`, ảnh preview là `ProductPreviewFrame` (fake chrome/device composite trong `packages/ui`).

**Sau** (`apps/web/src/marketing/sections/hero.tsx`, `marketing-surface.ts`, `copy.ts`):
- Bỏ `min-h` cưỡng bức ở section và cột copy (`marketingHeroCopy = ''`), bỏ eyebrow, bỏ 3 proof bullet, bỏ marquee block hoàn toàn khỏi markup (style cũ giữ nguyên export, không dùng nữa — không ảnh hưởng runtime).
- H1/sub rút ngắn khớp prototype: VI *"Vận hành sự kiện từ mã mời đến cổng."* + sub *"Phát mã mời, quản lý vé và kiểm soát cổng trong cùng một hệ thống. Khách tham dự nhìn thấy thương hiệu của bạn."*; EN tương đương *"Run your events from invite to gate."* — dịch tương đương, không claim số liệu mới.
- CTA còn 2 nút: primary `data-testid="cta-demo"` (giữ `demo` href/analytics cũ) + secondary `data-testid="cta-interest"` (`#interest`, giữ analytics cũ). Login hạ cấp thành text link `"Đã có tài khoản? Đăng nhập"` dưới actions — **vẫn giữ `data-testid="cta-login"` + `data-analytics-cta="hero_login"`** trên `<a>` (không mất tracking khi đổi từ Button sang text link).
- Ảnh: bỏ callsite `ProductPreviewFrame` (không sửa component trong `packages/ui`, chỉ đổi phía gọi ở web) → thay bằng `next/image` component riêng trong `hero.tsx` trỏ `/marketing/product/capture-catalog-1440.png` — **ảnh capture runtime thật**, không phải mockup/prototype asset.

### Capture + provenance
- Capture bằng Orca embedded browser: `orca tab create --url http://127.0.0.1:3417/ --worktree active`, `set viewport 1440 900`, `open http://127.0.0.1:3417/`, `screenshot <abs path>` → lưu `apps/web/public/marketing/product/capture-catalog-1440.png` (1440×900, xác nhận bằng `sips -g pixelWidth -g pixelHeight`).
- Route: `/` (consumer catalog "Khám phá sự kiện"), host `127.0.0.1:3417` (local dev stack), persona **guest** (chưa đăng nhập), state **ready** với dữ liệu demo public (2 sự kiện: MFest, Studio Night). Không chứa token/cookie/dữ liệu khách thật.
- Manifest: `apps/web/public/marketing/product/manifest.json` — route/build/host/persona/state/viewport/capturedBy/capturedAt/usedIn theo yêu cầu provenance.
- Tab đã `orca tab close` sau capture — không đụng tab có sẵn của root/user.

### Visual verify
- Screenshot sau redesign tại 390 và 1440 (VI): `apps/web/.uat-artifacts/UI869-FB2/hero-vi-390.png`, `hero-vi-1440.png` — hero giờ gọn (H1 → sub → 2 CTA → login link → demo note), ảnh catalog thật hiển thị bên phải (desktop) với caption *"Trang Khám phá · ảnh chụp sản phẩm thật, dữ liệu demo"*.
- **Honest gap:** công cụ `orca exec screenshot` trong phiên này chụp cùng 1 khung hình bất kể `set viewport` trước đó đổi 390/1024/1440 (đã log lại ở BATCH2 trước — xác nhận lại lần này là lỗi tool, không phải app); dùng ảnh 1440 xác nhận bố cục đúng, không có ảnh riêng 390 khác biệt về pixel — bù bằng `getBoundingClientRect()` tại 390 qua `eval`: `h1 {t:144,l:40,w:310}`, `figure {t:568.85,l:40,w:310}` → ảnh nằm dưới text (stack đúng mobile), `scrollW===innerW===390` (không overflow ngang).
- 1024/1440: `eval getBoundingClientRect` trên cùng tab sau nhiều lần `set viewport` liên tiếp trả về rect toàn 0 cho mọi element (kể cả khi lặp lại ở 1440 — vốn đã verify đúng bằng ảnh) mặc dù `window.innerWidth`/`document.body.offsetWidth` vẫn đúng và nội dung trang đúng — nghi là trạng thái phiên browser bị treo sau nhiều lần đổi viewport trên cùng page, không phải bug render. Không chặn kết luận vì ảnh 1440 đã xác nhận trực quan đúng bố cục 2 cột không shift.

## (2) Media thật thay mockup marketing

- **Hero**: xong, dùng capture thật (mục 1).
- **Bento 7 ô** (`src/marketing/sections/bento.tsx`): 7 ảnh `bento-*.webp` trong `public/marketing/` là asset mockup/design chưa có provenance xác nhận thật — **không có capability chụp phù hợp** cho các luồng này trong thời gian cho phép (invite/QR/gate/offline/admin/whitelabel/ops đòi hợp auth + nhiều bước thao tác không có fixture sẵn). Theo đúng chỉ đạo *"nếu featurecapability không có capture phù hợp thì feature text gọn, không dummy photo/prototype"*: đã bỏ hoàn toàn `<figure>`/`<Image>` khỏi 7 bento card, card giờ chỉ còn title + body text căn giữa (`marketingBentoCardInnerText`). Không còn tham chiếu `bento-*.webp` trong code.
- File `.webp` cũ **chưa xoá khỏi `public/marketing/`** (không ai dùng nữa nhưng việc xoá asset nằm ngoài phạm vi thời gian; không gây lỗi build/lint vì không còn import). Ghi nhận gap — coordinator quyết định xoá hay giữ.
- `HERO_PREVIEW` trong `content-config.ts` (trỏ `app-redeem-desktop/mobile.webp`) không còn được import ở đâu sau khi bỏ `ProductPreviewFrame` callsite — để nguyên (không xoá export để tránh side-effect ngoài dự kiến, không ảnh hưởng runtime/build).
- Test `tests/marketing-bento.test.ts` cập nhật theo đúng diff: bỏ assertion `bento-invite.webp` + so khớp buffer ảnh admin/ops, thay bằng assertion nội dung text khác biệt.

## (3) CatalogHeroBand consumer callsite

`apps/web/app/(consumer)/page.tsx`:
- **Trước**: `eyebrow="Vemoki · Sự kiện & vé"` (band mới của root đã bỏ nền tối, nhưng callsite còn truyền eyebrow) + link "Có mã mời? Đổi mã lấy vé" dùng `text-paper/75` (trắng — vô hình trên nền `bg-paper` sáng của band mới).
- **Sau**: bỏ `eyebrow` hoàn toàn (khớp mẫu catalog header gọn, không eyebrow). Link đổi `text-muted` cho đoạn chữ thường + `text-signal font-semibold hover:underline` cho chính link — đọc được trên nền paper, dùng đúng token signal thay vì paper.

## (4) Loading — bỏ màn đệm catch-all, skeleton theo route

**Trước**: `app/loading.tsx` (root, catch-all mọi route chưa có `loading.tsx` riêng) luôn render `SurfaceState kind="loading"` title *"Đang tải…"* + `CatalogSkeletonGrid` — áp dụng nhầm copy "danh sách sự kiện" cho mọi route lần đầu load (marketing, wallet, redeem, event-detail, claim/invite/account) vì Next.js dùng `loading.tsx` gần nhất theo segment tree, route nào chưa có file riêng sẽ rơi về root.

**Sau** — mỗi route có `loading.tsx` riêng khớp bố cục thật, giữ `aria-busy`/`sr-only` label, dùng `motion-reduce:animate-none` sẵn trong `Skeleton` primitive (`@ticket/ui`):

| Route | File mới | Bố cục skeleton |
| --- | --- | --- |
| `/` (catalog) | `app/(consumer)/loading.tsx` | Header band (title+intro) skeleton + `CatalogSkeletonGrid` — không còn status card "Đang tải…" |
| `/wallet` | `app/(consumer)/wallet/loading.tsx` | Title + intro + 3 thẻ vé skeleton, dùng `attendeeWalletPage` shell (khớp main class page thật) |
| `/redeem` | `app/(consumer)/redeem/loading.tsx` | Title + 1 field + 1 button skeleton trong khung form card, dùng `redeemPageMain`/`redeemNarrow` |
| `/t/[tenantSlug]/events/[eventSlug]` | `app/(consumer)/t/[tenantSlug]/events/[eventSlug]/loading.tsx` | Back-link + banner 220px + 2 cột (nội dung/sidebar CTA) |
| `/marketing`, `/marketing/en` | `app/marketing/loading.tsx` + `app/marketing/en/loading.tsx` | Khung hero trên nền `bg-ink` (không phải copy catalog), 2 cột text/ảnh placeholder — tránh đúng bug cũ (marketing hiện tạm skeleton "danh sách sự kiện" lúc cold-compile, đã ghi nhận ở batch trước) |
| Mọi route khác chưa có `loading.tsx` riêng (`claim`, `invite`, `account`, `privacy`, `support`, `dev/*`) | `app/loading.tsx` (sửa tại chỗ) | Generic text-block skeleton (title/2 dòng/1 field) — không còn "Đang tải…" + không còn copy catalog sai ngữ cảnh |

- Tất cả giữ `<main id="main">` + class shell gốc của page thật (không đổi `attendeeHomeMain`/`attendeeWalletPage`/`redeemPageMain`/`attendeeEventPage`) → nav/footer layout bọc ngoài (`ConsumerLayout`) không bị ảnh hưởng, footprint ổn định khi hydrate xong thay bằng content thật.
- Không tạo "generic catalog skeleton mọi route" — mỗi loading file dùng shell/class riêng của route đó.

## (5) Locale shift VI/EN — 390/1024/1440

- 390 và 1440 VI/EN: verify lại bằng screenshot (`hero-vi-390.png`, `hero-vi-1440.png` trong `.uat-artifacts/UI869-FB2/`) — header 72px, locale badge `min-h-9 min-w-9` không đổi kích thước theo state active (class `aria-[current=true]` chỉ đổi bg/color, không đổi box).
- 1024: **honest gap** — công cụ `eval`/`getBoundingClientRect` bị treo trả 0 sau nhiều lần đổi viewport liên tiếp trên cùng tab (xem mục 1), không lấy được số đo riêng cho 1024 lần này ngoài quan sát `window.innerWidth` phản hồi đúng theo lệnh `set viewport`. Không khẳng định "đủ" cho 1024 — cần tab mới/phiên mới để đo lại độc lập, để coordinator/QA xác nhận thêm nếu cần mốc 1024 tách biệt khỏi 390/1440 đã xác nhận bằng ảnh.
- Không phát hiện group nav bị dịch do đổi copy — `marketingNav`/`marketingNavLinks` không đổi trong batch này.

## Checks (không đổi diff mới nào sau lần chạy cuối, không chạy lại)

```
pnpm --filter @ticket/web lint        → PASS (0 warning)
pnpm --filter @ticket/web typecheck   → PASS
pnpm --filter @ticket/web test        → 286/286 PASS (sau khi sửa tests/marketing-bento.test.ts khớp diff mục 2)
pnpm --filter @ticket/web build       → PASS (next build, mọi route compile)
node scripts/ui-budget.mjs            → PASS, mọi metric giữ nguyên (0 regressions)
```

## Files changed (thêm vào bảng BATCH2 trước, không trùng)

| File | Thay đổi |
| --- | --- |
| `apps/web/src/marketing/sections/hero.tsx` | Redesign toàn bộ: bỏ eyebrow/proof/marquee/forced height, 2 CTA + login text link, ảnh thật qua `next/image` |
| `apps/web/src/marketing/marketing-surface.ts` | Thêm `marketingHeroMedia*`/`marketingHeroLogin`, bỏ `min-h` cưỡng bức hero, thêm `marketingBentoCardInnerText` |
| `apps/web/src/marketing/copy.ts` | Headline/sub rút ngắn VI/EN, thêm `hero.login_prefix`, `hero.media.alt`, `hero.media.caption` |
| `apps/web/src/marketing/sections/bento.tsx` | Bỏ `<Image>` mockup, card chỉ còn text |
| `apps/web/tests/marketing-bento.test.ts` | Cập nhật assertion khớp bento không ảnh |
| `apps/web/app/(consumer)/page.tsx` | Bỏ eyebrow `CatalogHeroBand`, sửa màu link redeem sang `text-signal` |
| `apps/web/app/loading.tsx` | Rewrite — generic skeleton, bỏ "Đang tải…" |
| `apps/web/app/(consumer)/loading.tsx` (mới) | Catalog skeleton riêng |
| `apps/web/app/(consumer)/wallet/loading.tsx` (mới) | Wallet skeleton |
| `apps/web/app/(consumer)/redeem/loading.tsx` (mới) | Redeem skeleton |
| `apps/web/app/(consumer)/t/[tenantSlug]/events/[eventSlug]/loading.tsx` (mới) | Event detail skeleton |
| `apps/web/app/marketing/loading.tsx`, `app/marketing/en/loading.tsx` (mới) | Marketing hero skeleton |
| `apps/web/public/marketing/product/capture-catalog-1440.png`, `manifest.json` (mới) | Capture thật + provenance |

## Chưa làm / honest gap (kế thừa batch trước + mới)

1. Bento 7 ô — không có media thật thay thế (đã chuyển text-only theo chỉ đạo, không phải "đã chụp xong").
2. 1024 locale/layout — chưa đo được số riêng do tool `eval` treo giữa phiên (xem mục 1/5); 390 và 1440 đã xác nhận bằng ảnh + rect.
3. `bento-*.webp` cũ và `HERO_PREVIEW` (content-config) không còn dùng nhưng chưa xoá — quyết định dọn dẹp để coordinator.
4. Chưa UAT các route auth-gated (wallet có data thật, claim/invite/account forms) bằng ảnh — vẫn là giới hạn cũ từ `UI867-WEB-DELIVERY.md`, ngoài scope việc loading-skeleton (chỉ audit bố cục qua source, không chụp runtime các state auth).
5. Không spawn subagent, không commit/push — chờ coordinator tích hợp cùng SHA sau khi review độc lập (reviewer ≠ implementer).
