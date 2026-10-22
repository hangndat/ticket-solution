# ADR-22 — Consumer web design system: Aceternity copy-paste + Tailwind v4 scoped

Ngày: 2026-10-22  
Trạng thái: **Chấp nhận** (slice 0 pipeline)  
Epic: [#766](https://github.com/hangndat/ticket-solution/issues/766)  
Liên quan: [#653](https://github.com/hangndat/ticket-solution/issues/653) (CSP nonce), [ADR-20](./ADR-20-PORTAL-ADMIN.md) (portal tách process)

## Bối cảnh

Consumer `apps/web` dùng Live Pulse v2 (`brand/vemoki/tokens.json`, ~3.4k dòng `globals.css`). User chọn **Aceternity UI** (copy-paste Free tier) kết hợp **shadcn** cho application primitives; **portal** giữ Ant Design 6; admin web freeze đến slice sau. Kiến trúc khả thi: [`FE-ARCH-ACETERNITY-FEASIBILITY-2026-10-22.md`](../reviews/FE-ARCH-ACETERNITY-FEASIBILITY-2026-10-22.md).

## Quyết định

1. **`apps/web`** adopt Tailwind CSS **v4** + `@tailwindcss/postcss` **chỉ trong app web** — không root workspace, không `apps/portal`.
2. **Không bật Tailwind Preflight** trên surface prod hiện có. **Slice 0:** `globals.css` import `vemoki-theme.css` + `live-pulse-legacy.css` **không layer** (cascade giữ nguyên như `main`); Tailwind `theme`/`utilities` chỉ bật khi slice có class utility trên route prod.
3. **`@ticket/ui` (`packages/ui`)** — `cn()`, token CSS (`vemoki-theme.css`), `UiMotionProvider` (`LazyMotion` + `domAnimation` async + `MotionConfig reducedMotion="user"`) export qua `@ticket/ui/client`. **Slice 0:** không mount provider ở `app/layout.tsx` — zero motion JS trên first-load prod. Slice dùng animation: bọc **island** (client component riêng) hoặc `dynamic(() => import('@ticket/ui/client'))` + `UiMotionProvider` chỉ quanh subtree cần Motion; không bọc root chrome.
4. **Token SoT:** `brand/vemoki/tokens.json` → generator CSS `@theme` + khối `:root` **legacy contract** (tên `--color-*`, `--spacing-*`, … không phụ thuộc `prefix(ui)`) + CI test `var()` trong `apps/web/app/*.css`.
5. **`components.json`** — shadcn + registry `@aceternity` (Free copy-paste qua CLI; Pro chỉ sau license).
6. **`apps/portal`** — **không đổi** stack antd / build / CSP trong epic này.

## Hệ quả

- (+) Tốc độ UI consumer, khớp mockup animated, ownership code trong git.
- (+) Portal không bị ảnh hưởng CSS/build.
- (−) Hai hệ styling (web Tailwind vs portal antd).
- (−) `globals.css` legacy song song đến hết migrate theo slice.
- (−) CSP `style-src 'unsafe-inline'` tiếp tục giai đoạn 1 (Motion + `style={rootVars}`); nonce wave riêng (#653).

## Phương án thay thế

| Phương án | Lý do từ chối / giữ |
| --- | --- |
| `@ticket/ui` + Radix-first (PD 2026-10-22) | Không primary theo user 22/10; shadcn/Radix vẫn dùng qua registry |
| Ant Design trên consumer | User từ chối |
| Tailwind monorepo shared với portal | Gây rủi ro antd + tăng scope portal |

## Rollback

1. Revert PR slice (gỡ `@ticket/ui`, Tailwind deps, `globals.css` import tailwind).
2. Khôi phục single-file `globals.css` từ `live-pulse-legacy.css` nếu cần hotfix.
3. Giữ legacy CSS làm SoT styling cho đến parity UAT — không xóa legacy trước khi slice UI hoàn tất.

## Slice 0 (đã giao)

Pipeline only: toolchain, token build, `components.json`, Motion provider **exported** (chưa mount prod), **không** thay đổi UI prod / không thêm hiệu ứng Aceternity trên route public. First-load JS/CSS prod phải ≈ `main` (không ship `motion` shell toàn app).

### Chiến lược nạp Motion (slice ≥ 1)

| Giai đoạn | Hành vi |
| --- | --- |
| Slice 0 | `UiMotionProvider` có trong `packages/ui`; **không** import `@ticket/ui/client` từ `layout.tsx` |
| Component animated | Client boundary cục bộ → `UiMotionProvider` bọc subtree → `LazyMotion` + `domAnimation` |
| CSP (#653) | Truyền `nonce` vào `UiMotionProvider` khi siết `style-src` |
