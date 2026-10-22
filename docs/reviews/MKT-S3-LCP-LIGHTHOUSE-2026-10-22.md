# MKT Slice 3 — Lighthouse mobile (hero LCP)

## PR #775 re-measure (2026-10-22, post F05/F06)

**Host:** `vemoki.com` / `www.vemoki.com` (`MARKETING_HOSTS` production).  
**Tool:** Lighthouse 13.5, mobile emulation, CPU slowdown ×4, headless Chrome.

| Locale path | Perf score | LCP |
| --- | ---: | ---: |
| VI `https://vemoki.com/marketing` | 0.91 | **~3.40s** |
| EN `https://vemoki.com/marketing/en` | 0.91 | **~3.42s** |

**Kết luận:** EN LCP vẫn **> 2.5s** trên origin marketing thật (chưa deploy slice 3 hero/form tách chunk tại thời điểm đo, hoặc CDN/TTFB + hero ảnh vẫn chiếm LCP). Local prod build trước đó (~2.1–2.2s) không tái hiện trên `vemoki.com` — khớp reviewer DoD F06.

**Nguyên nhân khả dĩ:** (1) ảnh hero LCP vẫn chờ network từ CDN/origin; (2) JS marketing route (kể cả sau giảm zod client) vẫn hydrate sau paint; (3) throttling LH mobile ×4 làm nặng main thread.

**Đề xuất (không chặn merge PR):** preload `fetchpriority=high` chỉ ảnh mobile đã có — tiếp theo đo sau deploy SHA mới; cân nhắc `priority` + `images.remotePatterns` tối ưu kích thước WebP/AVIF; giữ dynamic import form (đã bỏ zod client ~12 KiB gzip).

## Bundle (client JS, local `next build`)

| Metric | Trước (zod trong chunk form) | Sau (`interest-validate-client`) |
| --- | ---: | ---: |
| Client chunks chứa `zod` | 1 (dynamic form ~25.2 KiB gzip) | **0** |
| Dynamic form chunk gzip | ~25.2 KiB | **~13.3 KiB** |

## Lịch sử slice 3 (local prod, implementer)

| Locale | Viewport | Metric | Trước (slice 2) | Sau (slice 3 local) |
| ------ | -------- | ------ | --------------- | --------------------- |
| EN | 390×844 | LCP | ~3.4s | ~2.2s (local only) |
| VI | 390×844 | LCP | ~3.1s | ~2.1s (local only) |

**Thay đổi kỹ thuật:** `hero.tsx` preload mobile; dynamic `InterestForm`; client validation tách khỏi zod (F05).

**Lệnh đo local:** `pnpm --filter @ticket/web build && pnpm --filter @ticket/web start` + Lighthouse mobile trên `/marketing` và `/marketing/en` với `Host` khớp `MARKETING_HOSTS`.
