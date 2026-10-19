# Epic #491 — Milestone DoD gate (a) headless UAT (portal prod + GATE-STAY)

| Trường | Giá trị |
| ------ | ------- |
| Epic | [#491](https://github.com/hangndat/ticket-solution/issues/491) |
| Gate | Milestone DoD (a) — headless UAT (web/portal); không deploy thêm |
| Cutover merge | [#512](https://github.com/hangndat/ticket-solution/pull/512) trên `main` |
| Task / Dispatch | `task_5ffc67e2e3e6` · `ctx_93a878947a33` · Run `run_d04055a8969b` |
| Role | `reviewer-dod` (UAT evidence) · Cost tier `standard` |
| Architecture impact | Không (evidence + align harness dual-run) |
| Agent / session | Orca Cursor worker · terminal `term_aadd35c1-1c8b-4c62-9c89-3ace4739d349` |
| `origin/main` SHA tại lúc UAT (exact) | `acec09257ccd3c455f0575c35e79b7c7128a1924` |
| Tip branch evidence SHA (exact) | `25bcbc492b5a5149f53f79b8449401c2f0dc84f8` (`hangndat/portal-epic-491-uat`) |
| Captured (UTC) | `2026-10-19T04:52:48Z` |
| Verdict | **PASS** — cutover-check + portal-smoke prod; BFF deny-by-default 401 |

## Mục tiêu

1. Re-verify public cutover trên production (`portal.vemoki.com` + Gate stay / dual-run).
2. Playwright **headless** `portal-smoke` chống prod (không cliclick / headed / Computer Use).
3. Artifact + exact SHA cho milestone gate (a); Project → Chờ duyệt (không tự Hoàn thành Epic).

## Commands + exit codes

### 1) Integration tip

```bash
git fetch origin main
git rev-parse origin/main
# acec09257ccd3c455f0575c35e79b7c7128a1924
```

### 2) Cutover-check (public)

```bash
./scripts/portal-prod-cutover-check.sh
# CUTOVER_EXIT=0
# PORTAL_PROD_CUTOVER_RESULT PASS
```

Key PASS lines:

```text
PORTAL_PROD_CUTOVER_PASS DNS portal.vemoki.com A=113.161.116.5
PORTAL_PROD_CUTOVER_PASS TLS SAN includes portal.vemoki.com
PORTAL_PROD_CUTOVER_PASS portal / HTTP 200
PORTAL_PROD_CUTOVER_PASS portal /api/auth/login → IdP with portal redirect_uri
PORTAL_PROD_CUTOVER_PASS dual-run ON: app /admin → https://portal.vemoki.com/admin
PORTAL_PROD_CUTOVER_PASS POST /admin does not redirect to portal (HTTP 307)
PORTAL_PROD_CUTOVER_PASS GATE-STAY-APP: /gate Location=/auth?next=%2Fgate
PORTAL_PROD_CUTOVER_PASS ancafe.anphong.vn HTTP 200
PORTAL_PROD_CUTOVER_PASS realm JSON contains portal.vemoki.com redirect URIs
PORTAL_PROD_CUTOVER_RESULT PASS
```

### 3) Playwright portal-smoke (headless)

Harness trước đó assert GATE-STAY cho cả `/admin`, lệch ADR-20 dual-run ON trên prod (cutover PASS expect `/admin` → portal). Hotfix hẹp trong PR này: `scripts/web-uat.mjs` — `/gate` GATE-STAY; `/admin` cho phép/expect 30x → portal khi dual-run ON; follow `/gate` chấp nhận IdP authorize với `redirect_uri` app (không portal).

```bash
pnpm install --frozen-lockfile
mkdir -p apps/portal/.uat-artifacts
WEB_UAT_OUT_DIR="$(pwd)/apps/portal/.uat-artifacts" \
  PORTAL_BASE_URL=https://portal.vemoki.com \
  PRODUCT_ORIGIN=https://app.vemoki.com \
  WEB_BASE_URL=https://app.vemoki.com \
  pnpm exec node scripts/web-uat.mjs portal-smoke \
    https://portal.vemoki.com https://app.vemoki.com
# SMOKE_EXIT=0
```

JSON tóm tắt (PASS):

| Check | Kết quả |
| ----- | ------- |
| Portal `/` + `/auth` | HTTP 200 + screenshots |
| Staff login | **307** IdP (`oidc_authorize_redirect`) |
| Platform login | **307** |
| Evil `return=` | **307**; Location không chứa `evil.example` |
| CSRF Origin app→portal PUT branding | **403** |
| `/gate` GATE-STAY | **307** `/auth?next=%2Fgate` (`gate_stay`) |
| `/admin` dual-run | **302** `https://portal.vemoki.com/admin` (`dual_run_portal`) |
| Follow `/gate` | IdP authorize `auth.vemoki.com` · `redirect_uri` = `https://app.vemoki.com/...` (không portal) |

### 4) HTTP BFF deny-by-default (optional)

```bash
curl -sS -o /tmp/bff-me-subject.body -w "HTTP_CODE=%{http_code}\n" \
  https://portal.vemoki.com/api/bff/me/subject
# HTTP_CODE=401
# BODY: {"code":"UNAUTHENTICATED"}
```

## Artifact screenshot paths (gitignored)

| Shot | Path |
| ---- | ---- |
| Portal home | `apps/portal/.uat-artifacts/portal-home.png` |
| Portal auth | `apps/portal/.uat-artifacts/portal-auth.png` |
| App home | `apps/portal/.uat-artifacts/app-home.png` |
| App redeem | `apps/portal/.uat-artifacts/app-redeem.png` |
| App gate → IdP | `apps/portal/.uat-artifacts/app-gate-auth.png` |

## Limitations

- Không chạy full IdP password login / session BFF authenticated (không có credential UAT password trong task).
- UAT chống **production** live; không chứng minh CI local dual-run OFF matrix trong run này.
- Screenshots gitignored — chỉ cite path; không commit PNG.
- Hotfix harness (`web-uat.mjs`) nằm trên tip PR; cutover public không đổi. Revalidation DoD cần exact SHA tip PR sau merge.

## Verdict

**PASS** cho milestone gate (a) headless UAT: cutover-check PASS + portal-smoke PASS trên prod, BFF unauthenticated 401. Coordinator merge PR + đóng Epic theo DoD còn lại (không tự `Hoàn thành` Epic từ worker này).
