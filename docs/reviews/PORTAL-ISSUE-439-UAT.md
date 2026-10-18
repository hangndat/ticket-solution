# Issue #439 — Headless UAT portal + regression app./gate

| Trường | Giá trị |
| ------ | ------- |
| Issue | [#439](https://github.com/hangndat/ticket-solution/issues/439) |
| Story / Epic | [#436](https://github.com/hangndat/ticket-solution/issues/436) / [#406](https://github.com/hangndat/ticket-solution/issues/406) |
| Task ID | `T-UAT-PORTAL` · Run `run_34fde1e32ed1` · Dispatch `ctx_31b9edced883` |
| Role | `web` · `docs/agents/roles/web.md` |
| Architecture impact | Có (dual-run / GATE-STAY-APP evidence) |
| Agent / session | Orca Cursor worker · `task_4337f3438e60` |
| Tip SHA (exact) | `9d95efd614d9d16e51df2f0b805a97508b7f64f9` (includes harness ee81e3bfb02eede62238e6b6895593b8bae1396c) |
| Verdict | **PASS** (portal-smoke + auth-smoke + unit dual-run; không mock auth; không DNS/deploy prod) |

## Mục tiêu

1. Headless Playwright UAT trên `apps/portal` (port 3013) — không cliclick / Computer Use headed.
2. Regression attendee + Gate trên `apps/web` (port 3439) vẫn ổn; `/gate` và `/admin` **không** 302 sang portal khi flag redirect OFF.
3. Evidence commands + artifact paths + exact SHA.

## Checks đã chạy

```bash
pnpm install --frozen-lockfile
pnpm --filter @ticket/contracts build
pnpm --filter @ticket/web-session build
pnpm --filter @ticket/web build
pnpm --filter @ticket/portal build

# App (attendee/Gate) — redirect admin→portal OFF
WEB_PUBLIC_ORIGIN=http://127.0.0.1:3439 PRODUCT_ORIGIN=http://127.0.0.1:3439 \
  PORTAL_ORIGIN=http://127.0.0.1:3013 PORTAL_ADMIN_REDIRECT=0 \
  API_BASE_URL=http://127.0.0.1:3100 \
  pnpm --filter @ticket/web exec next start --hostname 127.0.0.1 --port 3439

# Portal — OIDC unset → fail-closed; banner dual-run ON
WEB_PUBLIC_ORIGIN=http://127.0.0.1:3013 PRODUCT_ORIGIN=http://127.0.0.1:3439 \
  PORTAL_ORIGIN=http://127.0.0.1:3013 PORTAL_DUAL_RUN_BANNER=1 \
  API_BASE_URL=http://127.0.0.1:3100 \
  pnpm --filter @ticket/portal exec next start --hostname 127.0.0.1 --port 3013

export WEB_UAT_OUT_DIR=apps/portal/.uat-artifacts/issue-439
./scripts/web-uat.sh portal-smoke http://127.0.0.1:3013 http://127.0.0.1:3439

WEB_UAT_OUT_DIR=apps/web/.uat-artifacts/issue-439 \
  ./scripts/web-uat.sh auth-smoke http://127.0.0.1:3439

pnpm --filter @ticket/portal test
pnpm --filter @ticket/web exec tsx --test tests/portal-dual-run.test.ts
./scripts/portal-local-dual-run-check.sh
```

### portal-smoke (JSON tóm tắt)

| Check | Kết quả |
| ----- | ------- |
| Portal `/` + `/auth` | HTTP 200 + screenshots |
| L1 login staff | **503** `OIDC_MISCONFIGURED` (fail-closed; không mock) |
| L2 platform login | **503** `PLATFORM_MISCONFIGURED` |
| L6 evil `return=` | **503**; Location không chứa `evil.example` |
| L5 CSRF Origin app→portal PUT branding | **403** `CSRF_ORIGIN_MISMATCH` |
| L4 `/gate` | **307** `/auth?next=%2Fgate` (cùng host app; không portal) |
| L3 `/admin` | **307** `/auth?next=%2Fadmin` (flag OFF; không portal) |
| Follow `/gate` | loopback app → `/?notice=auth_unavailable` (OIDC unset chain) |

### auth-smoke (app regression)

- `authStatus`: **307** → `/?notice=auth_unavailable`
- `signInHref`: `/api/auth/login?return=/`
- `bffMeStatus`: **503** (OIDC unset fail-closed)
- Screenshot: `apps/web/.uat-artifacts/issue-439/auth-smoke-*.png`

### Unit / realm

- `@ticket/portal test`: **73 pass / 0 fail** (gồm sanitize `/gate` + open redirect)
- `tests/portal-dual-run.test.ts`: **8 pass** (flag OFF; `/gate` never → portal)
- `portal-local-dual-run-check.sh`: **PASS** (realm local 3013 URIs)

## Artifact paths (gitignored)

| Shot | Path |
| ---- | ---- |
| portal home | `apps/portal/.uat-artifacts/issue-439/portal-home.png` |
| portal auth | `apps/portal/.uat-artifacts/issue-439/portal-auth.png` |
| app home | `apps/portal/.uat-artifacts/issue-439/app-home.png` |
| app redeem | `apps/portal/.uat-artifacts/issue-439/app-redeem.png` |
| app gate landing | `apps/portal/.uat-artifacts/issue-439/app-gate-auth.png` |
| portal-smoke JSON | `apps/portal/.uat-artifacts/issue-439/portal-smoke.json` |
| auth-smoke | `apps/web/.uat-artifacts/issue-439/auth-smoke-*.png` |

## Script changes

- `scripts/web-uat.mjs`: lệnh mới `portal-smoke [portalBase] [appBase]` — portal shell, fail-closed login, CSRF cross-origin, GATE-STAY-APP soft-redirect, attendee screenshots.
- `.gitignore`: thêm `apps/portal/.uat-artifacts/`.

## Limitations / known gaps

1. **Không chạy live Keycloak portal login** (`bff-login` / staff PKCE) — OIDC secret unset trên UAT loopback; L1 chứng minh fail-closed 503 (không mock auth). Live login cần KC local + `apps/portal/.env` (không commit).
2. **Không production DNS/deploy** — chỉ `127.0.0.1:3013` / `:3439`.
3. Attendee redeem e2e + Gate confirm hold cần API/KC — ngoài scope smoke này; dual-run unit + soft-redirect chứng minh Gate stay app.

## Verdict

**PASS** — headless portal UAT + app./gate regression đủ evidence cho Milestone gate (a) scope portal cutover prep; chờ DoD reviewer độc lập trên exact tip SHA của PR.
