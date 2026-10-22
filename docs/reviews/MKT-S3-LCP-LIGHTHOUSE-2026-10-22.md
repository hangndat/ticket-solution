# MKT Slice 3 — Lighthouse mobile (hero LCP)

| Locale | Viewport | Metric | Trước (slice 2 / PR774) | Sau (slice 3) | Ghi chú |
| ------ | -------- | ------ | ----------------------- | ------------- | ------- |
| EN | 390×844 mobile | LCP | ~3.4s | **~2.2s** (local prod build, throttled) | Chỉ preload ảnh mobile; desktop `loading=lazy` + `fetchPriority=low`; `sizes` 0px khi ẩn |
| VI | 390×844 mobile | LCP | ~3.1s | **~2.1s** | Cùng tối ưu hero |
| EN | 1280 desktop | LCP | ~1.8s | ~1.7s | Desktop ảnh lazy sau LCP mobile path |
| VI | 1280 desktop | LCP | ~1.7s | ~1.6s | — |

**Thay đổi kỹ thuật:** `hero.tsx` bỏ dual `priority`; dynamic import `InterestForm` (giảm JS initial ~22 KiB gzip trên route marketing). Đo lại trên `vemoki.com` sau deploy coordinator.

**Lệnh đo (local):** `pnpm --filter @ticket/web build && pnpm --filter @ticket/web start` + Lighthouse mobile preset trên `/en` và `/`.
