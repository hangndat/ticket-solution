# I18N P0 — DoD review · Portal SSR `<html lang>` (PR #569 / #566 P0-1)

| Trường | Giá trị |
| --- | --- |
| Verdict | **PASS** |
| Reviewer / session | James · dod · Role `reviewer-dod` · Cursor worker · terminal `term_ca927a3d-160c-4122-b78b-df34f7c6b18e` · Task `task_c1fad173cbb0` · Dispatch `ctx_76280f87d84d` · **≠** implementer (Higo · web · `ctx_30c4b85f999b`) |
| Scope | PR [#569](https://github.com/hangndat/ticket-solution/pull/569) · Issue [#566](https://github.com/hangndat/ticket-solution/issues/566) P0-1 · ownership **`apps/portal` only** |
| Commit SHA | `bed527421e8b1a3ab44f475b6fb2808a98833fc7` (exact tip; worktree HEAD khớp) |
| Architecture impact | **Không** — SSR `lang` từ cookie hiện có; không đổi contract/API/authz |

## Changed paths (3 files)

```text
apps/portal/app/layout.tsx
apps/portal/src/i18n/locale-server.ts
apps/portal/tests/locale-server.test.ts
```

Không secrets, không `.env`, không slice web/mobile/api.

## Checks (trên exact SHA)

| Check | Kết quả |
| --- | --- |
| `git rev-parse HEAD` | `bed527421e8b1a3ab44f475b6fb2808a98833fc7` |
| `pnpm --filter @ticket/portal test` | **125 pass** / 0 fail (gồm `i18n.test.ts` + `locale-server.test.ts`) |
| CI PR #569 run [39212424133](https://github.com/hangndat/ticket-solution/actions/runs/39212424133) | **pass** — `portal`, `ci`, `changes`, `turbo-persist`; backend/web/mobile skipped (path filter đúng) |

## AC verification

| AC | Kết luận |
| --- | --- |
| **AC-POR-2** — EN active → `<html lang="en">`; VI → `lang="vi"` | **Met** — `RootLayout` async, `lang={locale}` từ `readPortalLocaleFromServerCookies()`; cookie key `vemoki_portal_locale` (`PORTAL_LOCALE_STORAGE_KEY`) + `parsePortalLocale` (cùng logic client). Unit: `portalLocaleFromCookieValue('en'|'vi'|missing)` |
| Cookie `vemoki_portal_locale=en` → SSR `lang="en"` | **Met (code + unit)** — server đọc `jar.get(PORTAL_LOCALE_STORAGE_KEY)`; test map `en` / trimmed ` EN ` |
| Client sync sau hydrate | **Met** — `PortalLocaleProvider` vẫn `document.documentElement.lang` trong `useEffect` + `setLocale` (không gỡ) |
| AC-POR-3 / i18n parity không regress | **Met** — full portal test suite xanh; không sửa `messages.ts` |
| Scope portal-only | **Met** — diff chỉ `apps/portal` |
| Security / secrets | **Met** — N/A; không credential |

## Findings

| # | Severity | Mô tả |
| --- | --- | --- |
| 1 | nit | Chưa có integration test mock `next/headers` `cookies()` cho `readPortalLocaleFromServerCookies`; coverage hiện tại là helper thuần + review wiring layout — chấp nhận cho P0. |
| 2 | known gap (out of AC) | `metadata.title` / `description` vẫn VI; PR ghi TODO P1 — khớp inventory §6 gap P1, **không** thuộc AC-POR-2. |

## Limitations

- Không chạy live curl/view-source UAT trên `portal.` prod trong session reviewer; evidence dựa trên implementation khớp cookie key client + unit/CI trên SHA.

## Verdict rationale

Implementation đúng AC-POR-2: SSR first paint phản ánh `vemoki_portal_locale`, client vẫn đồng bộ `document.documentElement.lang`, tests/CI xanh, phạm vi portal-only. **PASS**.
