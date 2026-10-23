# ADR-22 — Consumer web design system: Aceternity copy-paste + Tailwind v4 scoped

Ngày: 2026-10-22  
Trạng thái: **Chấp nhận** (slice 0 pipeline; bổ sung Epic [#786](https://github.com/hangndat/ticket-solution/issues/786))  
Epic: [#766](https://github.com/hangndat/ticket-solution/issues/766) (slice 0), [#786](https://github.com/hangndat/ticket-solution/issues/786) (quy tắc UI + legacy roadmap)  
Liên quan: [#653](https://github.com/hangndat/ticket-solution/issues/653) (CSP nonce), [ADR-20](./ADR-20-PORTAL-ADMIN.md) (portal tách process), audit [`FE-UI-FRAMEWORK-AUDIT-2026-10-22`](../reviews/FE-UI-FRAMEWORK-AUDIT-2026-10-22.md) (PR [#799](https://github.com/hangndat/ticket-solution/pull/799)), BA parity [`BA-ADMIN-PLATFORM-PARITY-2026-10-22`](../reviews/BA-ADMIN-PLATFORM-PARITY-2026-10-22.md) (PR [#798](https://github.com/hangndat/ticket-solution/pull/798))

## Bối cảnh

Consumer `apps/web` dùng Live Pulse v2 (`brand/vemoki/tokens.json`, ~3.4k dòng `globals.css`). User chọn **Aceternity UI** (copy-paste Free tier) kết hợp **shadcn** cho application primitives; **portal** giữ Ant Design 6; admin web freeze đến slice sau. Kiến trúc khả thi: [`FE-ARCH-ACETERNITY-FEASIBILITY-2026-10-22.md`](../reviews/FE-ARCH-ACETERNITY-FEASIBILITY-2026-10-22.md).

## Quyết định (slice 0 — lịch sử, giữ nguyên)

1. **`apps/web`** adopt Tailwind CSS **v4** + `@tailwindcss/postcss` **chỉ trong app web** — không root workspace, không `apps/portal`.
2. **Không bật Tailwind Preflight** trên surface prod hiện có. **Slice 0:** `globals.css` import `vemoki-theme.css` + `live-pulse-legacy.css` **không layer** (cascade giữ nguyên như `main`); Tailwind `theme`/`utilities` chỉ bật khi slice có class utility trên route prod.
3. **`@ticket/ui` (`packages/ui`)** — `cn()`, token CSS (`vemoki-theme.css`), `UiMotionProvider` (`LazyMotion` + `domAnimation` async + `MotionConfig reducedMotion="user"`) export qua `@ticket/ui/client`. **Slice 0:** không mount provider ở `app/layout.tsx` — zero motion JS trên first-load prod. Slice dùng animation: bọc **island** (client component riêng) hoặc `dynamic(() => import('@ticket/ui/client'))` + `UiMotionProvider` chỉ quanh subtree cần Motion; không bọc root chrome.
4. **Token SoT:** `brand/vemoki/tokens.json` → generator CSS `@theme` + khối `:root` **legacy contract** (tên `--color-*`, `--spacing-*`, … không phụ thuộc `prefix(ui)`) + CI test `var()` trong `apps/web/app/*.css`.
5. **`components.json`** — shadcn + registry `@aceternity` (Free copy-paste qua CLI; Pro chỉ sau license). Cập nhật alias/prefix theo D-1: Issue [#794](https://github.com/hangndat/ticket-solution/issues/794).
6. **`apps/portal`** — **không đổi** stack antd / build / CSP trong epic này.

## Sửa đổi 2026-10-22 (Epic #786)

Nguồn: user chốt 22/10/2026 sau audit FE ([`FE-UI-FRAMEWORK-AUDIT-2026-10-22`](../reviews/FE-UI-FRAMEWORK-AUDIT-2026-10-22.md)); BA admin/platform parity (PR [#798](https://github.com/hangndat/ticket-solution/pull/798)). **Không deploy prod** trong epic; merge tuần tự khi reviewer PASS + CI xanh. PR [#784](https://github.com/hangndat/ticket-solution/pull/784) **đóng** — header/menu mobile làm lại bằng shadcn `Sheet` (WP-2).

### Quyết định D-1 … D-7

| ID | Quyết định | Chi tiết thực thi |
| --- | --- | --- |
| **D-1** | **Bỏ prefix Tailwind `ui:`** | Legacy CSS vào `@layer legacy` **trước** utilities. Thứ tự layer: `@layer theme, base, legacy, components, utilities;`. Copy-paste shadcn/Aceternity chạy class gốc; xóa `withUiPrefix` sau migrate (WP-2). Grep/đổi tên class legacy trùng utility (`.container`, `.hidden`…). **Lộ trình Preflight:** giữ *không Preflight* cho đến khi legacy = 0 (mục 6A.4 audit); sau đó `@import 'tailwindcss';` đầy đủ (Preflight bật). |
| **D-2** | **Prototype PD** | Giao **JSX + Tailwind** dùng shadcn / `@ticket/ui`, hoặc Figma/screenshot kèm **tên token**. **Cấm** giao HTML/CSS tĩnh BEM (nguyên nhân `marketing-uplift.css`). |
| **D-3** | **Token SoT mở rộng** | PD chốt một bảng duy nhất trong `brand/vemoki/tokens.json`: `radius`, `shadow`, `space`, `breakpoints`, bổ sung màu (`line`, `destructive`, `muted`, trạng thái…). Generator xuất **CSS `@theme`** (web) + **TS** cho mobile (`tokens.generated.ts`, WP-3). Khuyến nghị audit: radius sm/md/lg/xl = 8/12/18/24, spacing lưới 4, breakpoint Tailwind mặc định (+ custom trong `@theme` nếu PD cần 900/960). |
| **D-4** | **Light-only** | Web: `color-scheme: light`. Mobile: `userInterfaceStyle: 'light'`. Dark mode = epic riêng. |
| **D-5** | **Mobile styling** | Giữ **theme TS thuần + `StyleSheet.create`**; không NativeWind/Tamagui trong giai đoạn này. |
| **D-6** | **Bỏ `/gate` trên web** | Route staff gate web **xóa**; mobile thay thế. W-02 (tab a11y) giải quyết bằng xóa route — chỉ hotfix nếu xóa bị chặn. |
| **D-7** | **Đóng băng `app/admin` + `app/platform`** | **Không migrate** Tailwind (~100 class legacy). Chỉ sửa bug bảo mật/chặn vận hành. **Xóa route** khi `apps/portal` đạt parity ADR-20. BA [#791](https://github.com/hangndat/ticket-solution/issues/791) (PR [#798](https://github.com/hangndat/ticket-solution/pull/798)): portal **chưa đủ parity** — thiếu **Notify C-N** (template/reminder) và **Platform Operator mutate** (provision/suspend/limits/grant-create). Điều kiện xóa web admin/platform = đóng các gap đó trên portal + redirect `portal.vemoki.com`. |

### Vị trí component shadcn

- **Đề xuất (chốt trong epic):** component shadcn/Radix vendored đặt trong **`packages/ui`** (cùng ownership `@ticket/ui`, dùng chung consumer web; `apps/web` import qua workspace package).
- **Lý do:** một nơi cho primitive + shadcn; tránh drift giữa `apps/web/components/ui` và `@ticket/ui`; CI/test token và variant cva cùng package; portal vẫn antd — không import.
- **Cấu hình:** `apps/web/components.json` trỏ alias `@/components/ui` → `packages/ui/src/components/ui` (hoặc export path tương đương) — chi tiết implementation Issue [#794](https://github.com/hangndat/ticket-solution/issues/794). Aceternity copy-paste vẫn theo registry trong `components.json`, commit vào `packages/ui` khi là primitive dùng chung.

### Quy tắc bắt buộc (mọi thay đổi UI)

Áp dụng từ 2026-10-22; reviewer reject nếu vi phạm (nguồn audit mục 5).

**Web (`apps/web`, `packages/ui`)**

1. **Không** thêm selector vào `live-pulse-legacy.css`, `marketing-uplift.css`, `attendee-uplift.css`; **không** tạo `*.module.css` mới. Chỉ **xóa** hoặc sửa bug tại chỗ (ghi rõ PR).
2. UI mới hoặc bị chạm: Tailwind utilities + `@ticket/ui` / shadcn. Thiếu primitive → thêm vào `@ticket/ui` (cva), không CSS riêng.
3. Tương tác (dialog, sheet, menu, dropdown, tabs, popover, tooltip, toast): **bắt buộc** shadcn/Radix. Cấm focus trap / Esc / roving tabindex tự viết.
4. Không hex/rgba, không `p-[13px]` tùy ý trong tsx — chỉ token theme. Thiếu token → đề xuất `brand/vemoki/tokens.json` (PD duyệt).
5. Breakpoint chỉ `sm`/`md`/`lg`/`xl` (+ khai báo `@theme`). Cấm `@media (…px)` viết tay.
6. **Trước D-1 land (WP-2):** nếu vẫn còn prefix `ui:`, prefix **đứng đầu** (`ui:hover:…`, không `hover:ui:…`). **Sau D-1:** rule này hết hiệu lực.
7. Nút/link nút: `Button` / `buttonVariants()` — cấm class `btn`/`cta` mới.
8. Giữ `data-testid` khi migrate. Test hành vi/role/testid, không regex nội dung CSS.

**Mobile (`apps/mobile`)**

9. Không số cứng padding/margin/gap/borderRadius/fontSize/fontWeight — dùng `theme.space` / `theme.radius` / `typography.*`.
10. Không hex ngoài `src/theme/`.
11. Nút: `src/components/ui/button.tsx`; input: `src/components/ui/input.tsx`. Cấm `Pressable` trần làm nút.
12. Sheet/segmented/picker/switch/menu/grouped list: ưu tiên `@expo/ui` (hoặc formSheet expo-router).
13. Style tĩnh trong `StyleSheet.create`; inline chỉ giá trị động.

**PD**

14. Prototype JSX + Tailwind/shadcn hoặc design kèm tên token. Token mới vào `tokens.json` trước khi FE dùng.

**Chung**

15. Chạm route/component → **xóa legacy** cùng PR (CSS, class, helper, test regex CSS). PR migrate không giảm dòng legacy → reject.
16. `app/admin`, `app/platform` (web): **đóng băng** (D-7).

### Gate CI `scripts/ui-budget.mjs`

- **Mục đích:** ratchet chỉ **giảm** — CI fail khi chỉ số tăng (WP-1).
- **Baseline:** `scripts/ui-budget.baseline.json`; giảm chỉ số → cập nhật baseline trong cùng PR.
- **Web:** tổng dòng `apps/web/**/*.css` (trừ `globals.css`), số `*.module.css`, hex trong tsx, `@media (…px)` viết tay.
- **Mobile:** literal spacing/radius/fontSize, hex ngoài `src/theme`, `<Pressable` ngoài `components/ui`, `<Modal`.
- PR UI checklist (audit mục 7) bổ sung vào template khi WP-1 land.

### Lộ trình legacy (tóm tắt 6A)

Mục tiêu **legacy = 0** — không song song vô thời hạn.

| Bước | Nội dung |
| --- | --- |
| **1** | Xóa CSS chết (~1.4k dòng), gồm block review prototype trong `marketing-uplift.css`. |
| **2** | Migrate theo **3 wave** (marketing → attendee chrome/detail → redeem/claim/account…); mỗi wave xóa CSS tương ứng, hạ `ui-budget`, screenshot vi/en × 1280/390. |
| **3** | Xóa `app/admin` / `app/platform` khi portal parity (D-7). Xóa `/gate` web (D-6). Cuối: không còn `live-pulse-legacy.css`, uplift CSS, `*.module.css`; Preflight bật; không `prefix(ui)` / `withUiPrefix`. |

Tiêu chí đóng epic: lệnh kiểm tra **6A.4** trong audit (file CSS, grep prefix, token tay, route admin/platform, `node scripts/ui-budget.mjs` pass với baseline web CSS = 0).

Work packages WP-0 … WP-9: audit mục 6 (thứ tự WP-0 → WP-1 → D-1..D-3 → WP-2/3 → …).

### Điểm còn mở (không vượt scope user 22/10)

| # | Điểm | Owner / ghi chú |
| --- | --- | --- |
| O-1 | Bảng token radius/shadow/spacing/breakpoint cuối (D-3) | PD chốt trước WP-3 |
| O-2 | Map spacing mobile lẻ lưới → token | PD duyệt trước codemod WP-5 |
| O-3 | `components.json` alias chính xác | [#794](https://github.com/hangndat/ticket-solution/issues/794) |
| O-4 | Thời điểm merge WP-2 (D-1) vs hotfix W-01 | FE lead |
| O-5 | Parity portal cho D-7 | BA + BE; gap Notify C-N, Platform Operator mutate |
| O-6 | Epic dark mode (D-4) | Chưa lên lịch |
| O-7 | CSP nonce full strict (#653) vs Motion inline | Wave riêng |

## Hệ quả

- (+) Tốc độ UI consumer, khớp mockup animated, ownership code trong git.
- (+) Portal không bị ảnh hưởng CSS/build.
- (+) Epic #786: quy tắc + ratchet chặn phình CSS tay; shadcn/Radix bắt buộc; lộ trình legacy rõ → Preflight khi sạch.
- (−) Hai hệ styling (web Tailwind vs portal antd).
- (−) `globals.css` legacy song song đến hết migrate (wave 1–3 + D-6/D-7).
- (−) Đóng băng admin/platform web trong khi chờ portal parity — redirect vận hành qua portal.
- (−) CSP `style-src 'unsafe-inline'` tiếp tục giai đoạn 1 (Motion + `style={rootVars}`); nonce wave riêng (#653).
- (−) Chuyển D-1 có rủi ro class legacy trùng utility — cần grep + screenshot diff.

## Phương án thay thế

| Phương án | Lý do từ chối / giữ |
| --- | --- |
| `@ticket/ui` + Radix-first (PD 2026-10-22) | Không primary theo user 22/10; shadcn/Radix vẫn dùng qua registry |
| Ant Design trên consumer | User từ chối |
| Tailwind monorepo shared với portal | Gây rủi ro antd + tăng scope portal |
| Giữ prefix `ui:` lâu dài | User chốt bỏ (D-1); slice 0 giữ lịch sử |
| Migrate `app/admin` / `app/platform` sang Tailwind rồi xóa | Làm hai lần — D-7 đóng băng + xóa khi portal parity |
| Giữ `/gate` web song song mobile | User chốt bỏ (D-6) |
| `apps/web/components/ui` riêng khỏi `packages/ui` | Có thể tách island-only; **không** chọn làm default — drift primitive |

## Rollback

1. Revert PR slice (gỡ `@ticket/ui`, Tailwind deps, `globals.css` import tailwind).
2. Khôi phục single-file `globals.css` từ `live-pulse-legacy.css` nếu cần hotfix.
3. Giữ legacy CSS làm SoT styling cho đến parity UAT — không xóa legacy trước khi slice UI hoàn tất.
4. **Epic #786:** revert doc-only PR không ảnh hưởng runtime; revert WP có D-1/D-6/D-7 cần kiểm route redirect và portal parity trước khi khôi phục admin web.

## Slice 0 (đã giao)

Pipeline only: toolchain, token build, `components.json`, Motion provider **exported** (chưa mount prod), **không** thay đổi UI prod / không thêm hiệu ứng Aceternity trên route public. First-load JS/CSS prod phải ≈ `main` (không ship `motion` shell toàn app).

### Chiến lược nạp Motion (slice ≥ 1)

| Giai đoạn | Hành vi |
| --- | --- |
| Slice 0 | `UiMotionProvider` có trong `packages/ui`; **không** import `@ticket/ui/client` từ `layout.tsx` |
| Component animated | Client boundary cục bộ → `UiMotionProvider` bọc subtree → `LazyMotion` + `domAnimation` |
| CSP (#653) | Truyền `nonce` vào `UiMotionProvider` khi siết `style-src` |

## D-7 cutover — **Done: legacy removed** (Issue [#846](https://github.com/hangndat/ticket-solution/issues/846))

- **SHA:** `955839d8fb424f82df09cc7dddd7ea382a3f5082` (merge PR [#852](https://github.com/hangndat/ticket-solution/pull/852), Epic [#840](https://github.com/hangndat/ticket-solution/issues/840)).
- **PR Epic #840:** [#847](https://github.com/hangndat/ticket-solution/pull/847), [#848](https://github.com/hangndat/ticket-solution/pull/848), [#849](https://github.com/hangndat/ticket-solution/pull/849), [#850](https://github.com/hangndat/ticket-solution/pull/850), [#851](https://github.com/hangndat/ticket-solution/pull/851), [#852](https://github.com/hangndat/ticket-solution/pull/852).
- **Đã gỡ:** `apps/web/app/admin`, `app/platform`, `app/api/bff/admin/**`, `app/api/bff/platform/**`, `app/api/auth/platform/**`, `src/admin/**`, `src/platform/**` (helper dùng chung chuyển `src/bff/*`, `src/content/config-schema.ts`, …), `live-pulse-legacy.css`.
- **Giữ:** redirect GET/HEAD `/admin`·`/platform` → `PORTAL_ORIGIN` (`src/portal/dual-run.ts`); legacy staff API → **410** (`src/portal/legacy-cutover.ts` + `proxy.ts`).
- **Cascade CSS:** `@layer theme, base, components, utilities` (không còn `legacy`).
