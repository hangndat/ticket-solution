# Milestone gate (a) — Web headless UAT — Epic #527 (UX-UI Phase 2)

| Trường | Giá trị |
| ------ | ------- |
| Epic | [#527](https://github.com/hangndat/ticket-solution/issues/527) — Phase 2 user surfaces |
| PD handoff | [`docs/design/ux-ui-revamp/phase-2/`](../design/ux-ui-revamp/phase-2/) |
| Scope | `apps/web` tip (merged #533) + `scripts/web-uat.sh` evidence; **không** sửa harness |
| Tip SHA (exact) | `ee95f0ee3f0da32cfaad0d4e741b54dd1685d6ae` |
| Base URL (UAT) | `http://127.0.0.1:3527` (`next start`, `API_BASE_URL=http://127.0.0.1:3001`, OIDC unset → fail-closed) |
| Architecture impact | Không |
| Role | web (UAT) · Cost tier: standard |
| Agent / session | Orca Cursor worker · `task_b73e8bbfe15b` · `ctx_82ab26f5b44d` |
| Verdict | **PASS with known gap** — AC-H1 / AC-V1 / AC-A1 / AC-C1 / AC-E2 (unreachable) đủ evidence headless; AC-E1/E3 ready + AC-A2 signed-in + AC-C2/C3 cần API Nest + OIDC (không có trong wave này) |

## Mục tiêu gate

1. Headless Playwright (`scripts/web-uat.sh`) — **không** cliclick / Computer Use / headed Chrome.
2. Cover Phase 2 surfaces: `/` (Home polish), `/t/…/events/…` (nếu có), `/account`, `/claim`.
3. Map AC-E / AC-A / AC-C / AC-H (và AC-V1) theo `phase-2/README.md` §4 — feasible trên tip local.
4. Artifact durable + exact SHA; harness chỉ sửa nếu chặn gate (không cần).

## Checks đã chạy

```bash
git rev-parse HEAD
# ee95f0ee3f0da32cfaad0d4e741b54dd1685d6ae

pnpm install --frozen-lockfile
pnpm --filter @ticket/contracts build
pnpm --filter @ticket/web build

WEB_PUBLIC_ORIGIN=http://127.0.0.1:3527 API_BASE_URL=http://127.0.0.1:3001 \
  pnpm --filter @ticket/web exec next start --hostname 127.0.0.1 --port 3527

export WEB_UAT_OUT_DIR=apps/web/.uat-artifacts/epic-527
BASE=http://127.0.0.1:3527

./scripts/web-uat.sh auth-smoke "$BASE"
./scripts/web-uat.sh screenshot "$BASE/" "$WEB_UAT_OUT_DIR/home.png"
./scripts/web-uat.sh screenshot "$BASE/account" "$WEB_UAT_OUT_DIR/account.png"
./scripts/web-uat.sh screenshot "$BASE/claim" "$WEB_UAT_OUT_DIR/claim.png"
./scripts/web-uat.sh screenshot "$BASE/t/mfest-demo/events/mfest" \
  "$WEB_UAT_OUT_DIR/event-mfest-demo.png"
./scripts/web-uat.sh screenshot "$BASE/t/northline/events/form-forum-2026" \
  "$WEB_UAT_OUT_DIR/event-northline.png"
./scripts/web-uat.sh screenshot "$BASE/t/no-such-tenant/events/no-such-event" \
  "$WEB_UAT_OUT_DIR/event-notfound.png"
```

### auth-smoke (JSON)

| Field | Value |
| ----- | ----- |
| `ok` | `true` |
| `authStatus` | **307** |
| `authLocation` | `…/?notice=auth_unavailable` (OIDC unset) |
| `signInHref` | `/api/auth/login?return=/` |
| `loginCtaCount` | 2 (nav + hero) |
| `bffMeStatus` | **503** (OIDC fail-closed — chấp nhận) |
| Screenshot | `apps/web/.uat-artifacts/epic-527/auth-smoke-*.png` |

Harness **không** cần sửa — gate không bị chặn.

## Map AC (quan sát được trên tip)

| ID | Kết quả | Evidence |
| -- | ------- | -------- |
| **AC-H1** | **PASS** | Hero wordmark `vemoki` (`data-testid="hero-wordmark"`); tokens `--ink:#0B1220` `--paper:#F4F6F8` `--signal:#E11D48` `--focus:#2563EB`; font Sora + Be Vietnam Pro. Catalog fail → «Không tải được danh sách» + Thử lại (không fixture). Shot: `home.png` |
| **AC-V1** | **PASS** | Cùng tokens + Sora/Be Vietnam Pro trên Home / account / claim / event error; không Inter/purple/Syne hero trong CSS vars đã quan sát |
| **AC-A1** | **PASS** | SSR `/account`: signed-out «Chưa đăng nhập» + CTA `/api/auth/login?return=%2Faccount`. Playwright shot (BFF 503): error phiên «Không tải được phiên» + Đăng nhập / Về trang chủ — không list giả. Shot: `account.png` |
| **AC-A2** | **GAP** | Signed-in / Đăng xuất / deletion submit — cần OIDC + BFF 200; panel xóa + privacy link có trên anonymous UI |
| **AC-A3** | N/A | iOS-only |
| **AC-C1** | **PASS** | `/claim`: CTA «Đăng nhập rồi quay lại…» → `/api/auth/login?return=%2Fclaim`; «Nhận vé mời» disabled; empty token «Chưa có mã lời mời». Shot: `claim.png` |
| **AC-C2** | **GAP** | Issued / pending / denied — cần login + invitation token + API |
| **AC-C3** | **GAP** | Logout clears parked intent — cần session |
| **AC-E1** | **GAP** | Event **ready** composition — Nest `API_BASE_URL` không listen → không có published detail |
| **AC-E2** | **PASS** (unreachable) | `/t/mfest-demo/events/mfest` và `/t/no-such-tenant/…`: `data-testid="event-unreachable"` — «Không tải được sự kiện» + «Không thay bằng bản demo» + Về trang chủ. Distinguishing not-found vs unreachable cần API. Shots: `event-*.png` |
| **AC-E3** | **GAP** | CTA Đổi mã `tenantSlug`+`eventSlug` chỉ trên ready — code path có trong `page.tsx`; không quan sát live |

## Artifact paths (gitignored)

| Shot / file | Path |
| ----------- | ---- |
| auth-smoke | `apps/web/.uat-artifacts/epic-527/auth-smoke-*.png` + `auth-smoke.json` |
| Home `/` | `apps/web/.uat-artifacts/epic-527/home.png` |
| `/account` | `apps/web/.uat-artifacts/epic-527/account.png` |
| `/claim` | `apps/web/.uat-artifacts/epic-527/claim.png` |
| Event mfest (unreachable) | `apps/web/.uat-artifacts/epic-527/event-mfest-demo.png` |
| Event northline (unreachable) | `apps/web/.uat-artifacts/epic-527/event-northline.png` |
| Event missing (unreachable) | `apps/web/.uat-artifacts/epic-527/event-notfound.png` |
| HTML probes (optional) | `apps/web/.uat-artifacts/epic-527/{home,account,claim,event-*}.html` |

## Limitations / known gaps

1. **Không có Nest API** trên `:3001` — Home catalog + event detail ở trạng thái unreachable (đúng fail-closed; không demo fallback). AC-E1/E3 ready chưa chứng minh trên live.
2. **Không có Keycloak local** — không chạy `bff-login` / `auth-logout`; AC-A2 signed-in, AC-C2/C3 chưa cover.
3. **Account Playwright vs SSR:** HTML anonymous signed-out; sau hydrate với BFF 503 UI hiển thị error phiên — cả hai đều không fake membership list.
4. **Không deploy prod**; gate (a) chỉ trên tip local `next start`.
5. Harness không đổi trong task này.

## Verdict

**PASS with known gap** — milestone gate (a) web headless UAT cho Epic #527 đủ evidence anonymous Phase 2 surfaces + Live Pulse tokens trên exact tip SHA `ee95f0ee3f0da32cfaad0d4e741b54dd1685d6ae`. Gap có chủ đích: event ready + authenticated claim/account flows cần API + OIDC ở wave riêng / môi trường đủ stack.
