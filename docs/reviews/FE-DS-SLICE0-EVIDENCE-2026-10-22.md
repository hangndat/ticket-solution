# FE DS slice 0 — bằng chứng không regress (Epic #766)

| Trường | Giá trị |
| --- | --- |
| Ngày | 2026-10-22 |
| Branch | `hangndat/ds-slice0` |
| Base `main` | `bfd17c50790ce31c58b63d933773ae4175102058` |
| Phạm vi | Pipeline only — không đổi markup/route prod |

## UI prod

- `apps/web/app/live-pulse-legacy.css` **byte-identical** với `main:apps/web/app/globals.css` (SHA-256 khớp) — toàn bộ Live Pulse v2 giữ nguyên; `globals.css` chỉ thêm import Tailwind v4 (theme + utilities, **không Preflight**).
- Không thêm component Aceternity trên route public; `/dev/design-system` trả 404 khi `NODE_ENV=production`.

## CSP / API / portal

| Kiểm tra | Kết quả |
| --- | --- |
| `git diff main -- apps/web/next.config.ts apps/web/proxy.ts apps/web/app/api` | **rỗng** |
| `apps/web/tests/csp-nonce-feasibility.test.ts` + `next-config-security.test.ts` | Pass trong `pnpm --filter @ticket/web test` |
| `git diff main -- apps/portal` | **rỗng** |

## Bundle (sau `pnpm exec turbo run build --filter=@ticket/web...`)

Đo tổng file trong `apps/web/.next/static/chunks/` (local build 2026-10-22):

| Metric | Slice 0 |
| --- | ---: |
| JS chunks (bytes) | 1 168 587 |
| CSS chunks (bytes) | 66 491 |

Delta JS ~+37 KiB so với artifact `.next` còn trên worktree `main` cũ (1 131 385 B) — chủ yếu `UiMotionProvider` / `motion` lazy client; **không** có route UI mới trên prod. CSS tách chunk do Tailwind pipeline; legacy rules không đổi.

**Lighthouse:** chưa chạy trên stack đầy đủ trong session worker (cần `fe-uat-stack` + server); slice 0 không đổi DOM prod — visual parity dựa trên legacy CSS identity + test suite.

## Visual regression

- Baseline tham chiếu: [`docs/reviews/assets/FE-PD-DESIGN-SYSTEM-2026-10-22/`](./assets/FE-PD-DESIGN-SYSTEM-2026-10-22/) (prod guest catalog).
- Slice 0: **không** chụp lại PNG trong PR — kỳ vọng pixel-identical vì legacy CSS không đổi; slice 1+ sẽ bật Playwright screenshot gate.

## CI commands (local)

```bash
pnpm --filter @ticket/ui test
pnpm exec turbo run lint typecheck test build --filter=@ticket/web...
pnpm --filter @ticket/web test:routes
```
