# Milestone gate (a) — Web headless UAT — Epic #471

| Trường | Giá trị |
| ------ | ------- |
| Epic | [#471](https://github.com/hangndat/ticket-solution/issues/471) |
| Scope | `scripts/web-uat.*` + evidence; tip `apps/web` auth IA (đã merge) |
| Tip SHA (exact) | `80640cd6bff92347cfb2b2f80876d414c456341d` (harness + evidence; PR tip may include SHA-fix commit) |
| Base URL (UAT) | `http://127.0.0.1:3471` (`next start`, OIDC unset → fail-closed) |
| Architecture impact | Không |
| Role | web (+ coordinator scripts) |
| Agent / session | Orca Cursor worker · `task_9cb4dcce40c1` · `ctx_47852382a557` |
| Verdict | **PASS** (auth-smoke + screenshots + `/auth` redirect). `auth-logout` harness cập nhật IA; live Keycloak login/logout không chạy ở đây (không có KC local; prod `app.vemoki.com` vẫn `/auth` 200 — chưa deploy stub). |

## Mục tiêu gate

1. Harness `auth-smoke` / `auth-logout` khớp IA đã merge: Login CTA `/api/auth/login?return=…`; `/auth` chỉ thin redirect (không assert product auth UI).
2. Headless Playwright screenshots: Home `/`, `/redeem`, `/account`; follow/ghi nhận redirect `/auth`.
3. Evidence durable + PR scripts/docs.

## Checks đã chạy

```bash
# App tip (không đổi apps/web trong PR này) build + serve
pnpm install --frozen-lockfile
pnpm --filter @ticket/contracts build
pnpm --filter @ticket/web build
WEB_PUBLIC_ORIGIN=http://127.0.0.1:3471 API_BASE_URL=http://127.0.0.1:3001 \
  pnpm --filter @ticket/web exec next start --hostname 127.0.0.1 --port 3471

# Headless UAT (chrome-headless-shell / Playwright — không cliclick / computer click)
export WEB_UAT_OUT_DIR=apps/web/.uat-artifacts/epic-471
./scripts/web-uat.sh auth-smoke http://127.0.0.1:3471
./scripts/web-uat.sh screenshot http://127.0.0.1:3471/ apps/web/.uat-artifacts/epic-471/home.png
./scripts/web-uat.sh screenshot http://127.0.0.1:3471/redeem apps/web/.uat-artifacts/epic-471/redeem.png
./scripts/web-uat.sh screenshot http://127.0.0.1:3471/account apps/web/.uat-artifacts/epic-471/account.png
curl -sI http://127.0.0.1:3471/auth | tee apps/web/.uat-artifacts/epic-471/auth-redirect-headers.txt
```

### auth-smoke (JSON)

- `authStatus`: **307**
- `authLocation`: `…/?notice=auth_unavailable` (OIDC unset)
- `signInHref`: `/api/auth/login?return=/`
- `loginCtaCount`: 2 (nav + hero)
- `bffMeStatus`: **503** (OIDC fail-closed — chấp nhận cùng 401 khi OIDC configured)
- Screenshot: `apps/web/.uat-artifacts/epic-471/auth-smoke-*.png`

### `/auth` redirect

```text
HTTP/1.1 307 Temporary Redirect
location: http://localhost:3471/?notice=auth_unavailable
```

Không còn product auth shell trên `/auth` (stub → Home notice).

## Artifact paths (gitignored)

| Shot | Path |
| ---- | ---- |
| auth-smoke | `apps/web/.uat-artifacts/epic-471/auth-smoke-*.png` |
| Home `/` | `apps/web/.uat-artifacts/epic-471/home.png` |
| `/redeem` | `apps/web/.uat-artifacts/epic-471/redeem.png` |
| `/account` | `apps/web/.uat-artifacts/epic-471/account.png` |
| `/auth` headers | `apps/web/.uat-artifacts/epic-471/auth-redirect-headers.txt` |

## Script changes

- `scripts/web-uat.mjs` `auth-smoke`: assert `/auth` 307/308 + Location hợp lệ; follow landing trên cùng host `base`; Home CTA `a[href^="/api/auth/login?return="]`; anonymous BFF `401|503`.
- `loginKeycloak`: start PKCE tại `/api/auth/login?return=/` (không click UI trên `/auth`).
- `auth-logout`: chờ post-logout chain `/auth` stub → `/`; listen response `/auth`; vẫn probe `/admin` → `/auth?next=`.

## Limitations / known gaps

1. **Không chạy `auth-logout` live** trong wave này — thiếu Keycloak local; cần `bff-login` credentials + realm `post_logout_redirect_uri` allowlist. Harness đã align IA.
2. **Prod `https://app.vemoki.com/auth` vẫn HTTP 200** (UI cũ) tại thời điểm UAT — gate (a) chứng minh trên tip local `next start`, không deploy prod.
3. Anonymous BFF **503** khi OIDC unset (đúng fail-closed); với OIDC configured kỳ vọng **401**.

## Verdict

**PASS** — milestone gate (a) web headless UAT cho Epic #471 đủ evidence trên exact tip SHA của PR scripts+docs; screenshots + auth-smoke + `/auth` 307.
