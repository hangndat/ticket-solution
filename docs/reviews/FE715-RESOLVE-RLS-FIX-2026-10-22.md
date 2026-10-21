# FE-715 ACC-01 — resolve rate-limit RLS fix

| Trường | Giá trị |
| --- | --- |
| **Epic** | #715 · ACC-01 |
| **Worktree** | `/Users/admin/orca/workspaces/main/fe715-resolve-rls-fix` |
| **Branch** | `hangndat/fe715-resolve-rls-fix` |
| **Base** | `2cabb6c7a09d400199834d86a83fe3953819aa80` |

## Thay đổi

- `apps/api/src/redemptions-resolve.ts`: bọc `tryConsumeRateLimit` trong `withTenant(db, user.userId, …)` thay cho `$transaction` không set `app.tenant_id`.
- `apps/api/test/redemptions-resolve-rls.test.cjs`: Postgres Docker + role `resolve_rls_login` / `ticket_runtime` (NOBYPASSRLS).

## Before / after

| Case | Trước fix | Sau fix |
| --- | --- | --- |
| `tryConsumeRateLimit` không tenant ctx | `22P02` / `42501` (RLS) | Test assert fail closed |
| `POST /v1/redemptions/resolve` (fixture) | **500** | **2xx** + `resolveToken` |
| Actor A limit=1 vs actor B | — | B counters độc lập |

## Commands (local)

```bash
pnpm --filter @ticket/contracts build
pnpm --filter @ticket/backend build
pnpm --filter @ticket/api build
pnpm --filter @ticket/api lint
node --test apps/api/test/redemptions-resolve-rls.test.cjs
```

## UAT / runtime

- Cần API `pnpm --filter @ticket/api start` với `DATABASE_URL` runtime (`d9_demo_rt`), `SINGLE_CODE_RESOLVE_GLOBAL=1`, HMAC/pepper khớp seed.
- Mã AVAILABLE: `DEMO-MFEST-007` / `008` (xem `FE715-RESOLVE500-DIAG-2026-10-22.md` trên FE-refactor worktree).
- Không dùng `ticket_d9_demo` cho test destroy/reseed — test dùng container riêng.

## Giới hạn

- Không đổi migration/RLS/grants.
- Full BFF CSRF flow không cover trong test (API direct đủ correlate ACC-01 upstream).
