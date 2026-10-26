# O26-PR4 — Dissolve page chrome batch 1 (#975)

**Worker:** Higo (web) · **Slice:** O26-PR4 · **Epic:** #914 · **Issue:** #975  
**Base worktree:** PR3 tip `ecda980af0231466c62164d9c77f308e779d0291` (PR #982 chờ review — **chưa mở PR4** theo coordinator)

## Thay đổi

- **Batch 1** (`auth`, `/`, `onboarding/*`, `account/security`, `t/[tenantId]` tenant home): không còn `PortalPage` / `@ant-design/pro-components` trên các route này.
- `app/t/[tenantId]/page.tsx`: gỡ `PortalPage`, `ProList`, `StatisticCard` → antd `Typography` + `Flex`/`Space` (title/meta/extra), `Card` + `Statistic`, `List` + `List.Item.Meta`; giữ loading/error/403/PENDING, capability buttons, `firstAllowedEventPath`.
- `app/onboarding/page.tsx`: bỏ gradient brand trên Card signup (O26 default antd).
- **`portal-page.tsx` giữ lại** — các route batch 2+ vẫn import (PR5+).

**Không đụng:** BFF/API/contracts, #928 data, `portal-page.tsx` xóa file (chưa hết caller), PR mở tới `main`.

## Rà nhánh route (manual)

| Route | Nhánh | Hành vi giữ |
| --- | --- | --- |
| `/auth` | `error` param | `Result` + login CTA |
| `/auth` | default | Card + OIDC login link |
| `/` | loading / redirecting | Spin |
| `/` | customer | 403 attendee |
| `/` | error | Alert + reload |
| `/` | empty | Card CTA onboarding + account |
| `/onboarding` | loading / redirect / customer | Spin / 403 |
| `/onboarding` | signup | Form registration → PENDING |
| `/onboarding/[tenantId]` | pending / first-run / denied / error | Steps, Result, Alert (không đổi logic) |
| `/account/security` | loading / error / ready | Descriptions + logout links |
| `/t/[tenantId]` | loading / error / 403 / PENDING | Spin, Alert, Result, pending → onboarding |
| `/t/[tenantId]` | ready | Inline chrome + stats + event list |

Locale (`usePortalLocale`), permission (`useTenantAccess`, `canPerformTenantAction`), OIDC redirect (`loadShellContext` unauthenticated), onboarding PENDING/first-run: **không đổi contract**.

## Checks (local)

| Lệnh | Kết quả |
| --- | --- |
| `pnpm --filter @ticket/contracts build` | PASS |
| `pnpm --filter @ticket/web-session build` | PASS |
| `pnpm --filter @ticket/portal lint` | PASS |
| `pnpm --filter @ticket/portal typecheck` | PASS |
| `pnpm --filter @ticket/portal test` | PASS |
| `pnpm --filter @ticket/portal build` | PASS |

**Route smoke:** không chạy Playwright/UAT headless trong slice (fixture OIDC/MFA); dựa trên test logic (`onboarding`, `home-entry`, `event-access`) + build.

## SHA

| Trường | Giá trị |
| --- | --- |
| **codeSha** | `02522b5ab86e87e2696ab1b400e177781fa57851` |
| **evidenceSha** | `02522b5ab86e87e2696ab1b400e177781fa57851` |

## Verdict worker

**Code complete** cho O26-PR4 batch 1; chờ PR3 merge + reviewer; **draft PR4** do coordinator mở sau merge `main`.
