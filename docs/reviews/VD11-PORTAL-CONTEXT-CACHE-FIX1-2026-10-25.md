# VD11 Portal — context cache fix batch 1 (C-F01 / C-F02)

**Ngày:** 2026-10-25 · **Implementer:** Linh (worker `task_4be60ef2f9ab`)  
**Base:** `7109fc5ae23c4cb4bbf3f7d85805ec8a73cc449a` (post-deploy review SHA)  
**SHA (handoff):** `4fb1e96c2c52fd70a6c9cf90607e839c889a31ac` (fix `a77c7d14` + review doc `4fb1e96c`)  
**Scope:** `apps/portal/**` — C01/C02 only; **không** sửa P-F05 / `ConfigProvider` / theme shell.

## Findings addressed

| ID | Fix |
| --- | --- |
| **C-F01** | Event `Select` `allowClear`: `onChange(undefined)` giờ map qua `routeAfterEventSelectChange` → `/t/{tenant}` only; bỏ `onClear` riêng để không double `router.push`. |
| **C-F02** | Bỏ `useState(pathEventId/pathTenantId)` stale; `resolveShellEffectiveEventId` — org home không resurrect cache; org subroute vẫn dùng cache hợp lệ. `parsePathEventId` loại `undefined` segment. |

## Files

- `src/nav/portal-context-routes.ts` — pure route/resolve helpers (tested).
- `src/components/portal-context-strip.tsx` — C01.
- `src/components/portal-shell.tsx` — C02.
- `src/context-cache/persist.ts` — dùng shared path helpers.
- `tests/portal-context-routes.test.ts` — clear/select/resolve (không mirror Ant internals).

## Checks

| Check | Kết quả |
| --- | --- |
| `pnpm --filter @ticket/portal test` | **191/191 PASS** (local, pre-commit tree) |
| `pnpm --filter @ticket/portal exec tsc --noEmit` | **PASS** |
| `pnpm --filter @ticket/portal build` | **PASS** |
| `eslint` (paths trong diff) | **PASS** (0 errors) |
| `pnpm --filter @ticket/portal lint` (full package) | **Không chạy gate** — 2× `set-state-in-effect` + `no-img-element` đã có trước cache/P05 (post-deploy review). |

## C01 / C02 acceptance (logic)

- Clear event → target `/t/{tenant}`; không `/e/undefined`.
- Org home (`/t/{tenant}`) → `effectiveEventId` null ngay cả khi cache chưa persist.
- Deep link `/e/{id}` → clear → org home; persist effect ghi `eventByTenant[tenant]=null` (existing `context-cache.test.ts`).
- Org subroute `/t/{tenant}/members` → cache event vẫn cho menu (test `resolveShellEffectiveEventId`).
- Đổi tenant vẫn `router.push(/t/{id})` — không đổi trong batch này.

## Limitations

- Không có React/Ant integration test (Playwright); reviewer UAT clear trên `:3334` vẫn khuyến nghị sau merge build.
- P-F05 theme không revalidate trong batch này (coordinator gate riêng).
- Full package `lint` chưa xanh — pre-existing, không phát sinh từ diff cache.

## Verdict (implementer)

**Ready for independent review** — logic + unit tests pass; chờ reviewer exact SHA + UAT clear event.
