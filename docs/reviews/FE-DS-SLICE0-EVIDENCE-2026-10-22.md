# FE DS slice 0 — bằng chứng không regress (Epic #766)

| Trường | Giá trị |
| --- | --- |
| Ngày | 2026-10-22 |
| Branch | `hangndat/ds-slice0` (PR #768) |
| Base `main` | `bfd17c50790ce31c58b63d933773ae4175102058` |
| Phạm vi | Pipeline only — không đổi markup/route prod |

## UI prod

- `apps/web/app/live-pulse-legacy.css` **byte-identical** với `main:apps/web/app/globals.css` (SHA-256 khớp) — Live Pulse v2 giữ nguyên; `globals.css` chỉ thêm `@import` token theme + legacy **unlayered** (parity cascade).
- Không mount `UiMotionProvider` trên `app/layout.tsx` (slice 0 — zero motion JS first-load).
- Không thêm component Aceternity trên route public; `/dev/design-system` trả 404 khi `NODE_ENV=production`.

## CSP / API / portal

| Kiểm tra | Kết quả |
| --- | --- |
| `git diff main -- apps/web/next.config.ts apps/web/proxy.ts apps/web/app/api` | **rỗng** |
| `apps/web/tests/csp-nonce-feasibility.test.ts` + `next-config-security.test.ts` | Pass trong `pnpm --filter @ticket/web test` |
| `git diff main -- apps/portal` | **rỗng** |

## Bundle (sau `pnpm exec turbo run build --filter=@ticket/web...`)

Tổng bytes `apps/web/.next/static/chunks/*.{js,css}` (`node scripts/measure-web-chunk-bytes.mjs`):

| Baseline | JS (bytes) | CSS (bytes) |
| --- | ---: | ---: |
| `main` @ `bfd17c5` | 1 168 562 | 66 491 |
| PR (post gap fix) | 1 168 587 | 74 751 |
| **Δ** | **+25 (~0%)** | **+8 260** |

Δ JS ≈ 0 (đã gỡ motion shell toàn app). Δ CSS từ postcss/Tailwind token pipeline + chunk tách; legacy rules không đổi.

## Visual regression (main vs PR)

Stack: `./scripts/fe-uat-stack.sh bootstrap` + API `:3001` + `next start` (main worktree @ `bfd17c5` vs PR).

```bash
./scripts/fe-ds-slice0-visual-parity.sh
# hoặc: node apps/web/tests/fe-ds-slice0-visual-parity.mjs capture|compare
```

| Route | Viewport | diffPixels |
| --- | --- | ---: |
| `/` | 1280 / 390 | 0 |
| `/t/mfest-demo/events/mfest` | 1280 / 390 | 0 |
| `/redeem` | 1280 / 390 | 0 |
| `/account` | 1280 / 390 | 0 |
| `/privacy` | 1280 / 390 | 0 |

Báo cáo máy: `docs/reviews/assets/FE-DS-SLICE0-parity-pr/parity-report.json` (`allZero: true`).

## CI commands (local)

```bash
pnpm --filter @ticket/ui test
pnpm exec turbo run lint typecheck test build --filter=@ticket/web...
pnpm --filter @ticket/web test:routes
```
