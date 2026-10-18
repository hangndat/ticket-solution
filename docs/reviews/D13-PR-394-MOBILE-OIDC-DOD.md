# D13 — DoD · Mobile OIDC redirect `vemoki://` (PR #394)

| Trường | Giá trị |
| --- | --- |
| Verdict | **PASS with known gap** |
| Reviewer / session | Role `reviewer-dod` · Agent Cursor · Orca terminal `term_38396dcb-966a-4c1a-b9e7-a687aff5ccd6` · Task `task_9c249fbe034d` · Dispatch `ctx_80f17df55686` · **≠** implementer (PR author commit on `hangndat/d13-bug-ios-oidc`) |
| Scope | PR [#394](https://github.com/hangndat/ticket-solution/pull/394) · ownership **`apps/mobile` only** · OIDC redirect/logout scheme + prod bake host regression vs O13 apex/`app.vemoki.com` |
| Commit SHA | `43f28fffd624f2bdfd73ed17991397d1441fd510` (exact tip `gh pr view 394` / `origin/hangndat/d13-bug-ios-oidc` — ổn định suốt revalidation; một commit trên branch) |
| Prior review | Không có artifact `docs/reviews/*394*` trước đó → đây là DoD đầu trên tip (revalidate = xác nhận tip chưa đổi + review đầy đủ) |
| Architecture impact | **Không** — đổi hằng scheme / export URI + tests; không OpenAPI, không BE contract, không RLS |
| Merge | **Không** — reviewer không merge |

## Diff scope (vs `main`)

8 files, `+54/-14`, chỉ `apps/mobile`:

- `src/identity/app-schemes.ts` — `OIDC_REDIRECT_SCHEME` → `PRIMARY_APP_SCHEME` (`vemoki`); export `OIDC_POST_LOGOUT_URI`
- `src/identity/oidc-login.ts` — logout dùng `OIDC_POST_LOGOUT_URI` (thay literal)
- `app.config.ts` — export `VEMOKI_PROD_PUBLIC` (issuer `auth.vemoki.com` không đổi)
- Tests: schemes, prod hosts, privacy apex; README / `+native-intent` comment

Expo `scheme: ['vemoki', 'ticketsolution']` giữ dual-run. Không đụng `apps/api` / `apps/web`.

## Checklist DoD

| Mục | Kết luận |
| --- | --- |
| Ownership slice mobile-only | **Met** |
| Không secrets / `.env` / credential thật | **Met** |
| Exact tip SHA ổn định khi duyệt | **Met** — tip = `43f28ff…` trước/sau review |
| Login redirect khớp brand + Keycloak allowlist trong repo | **Met** — `OIDC_REDIRECT_SCHEME === 'vemoki'`; `infra/keycloak/realm-ticket.json` client `ticket-mobile` đã có `vemoki://oauth/callback` + `vemoki://oauth/logout` (và legacy `ticketsolution://…`) |
| Login/logout cùng brand scheme | **Met** — callback `vemoki` + `OIDC_POST_LOGOUT_URI = vemoki://oauth/logout` |
| Issuer / privacy độc lập O13 apex vs `app.vemoki.com` | **Met** — tests pin `https://auth.vemoki.com/realms/ticket`, `https://vemoki.com/privacy`, reject `app.vemoki.com` |
| CI mobile xanh trên tip | **Met** — [run 39130086441](https://github.com/hangndat/ticket-solution/actions/runs/39130086441) · `mobile`+`ci`+`changes`+`turbo-persist` success; BE/web/DB skipped (path filter) |
| Unit tests trên exact SHA | **Met** — worktree detach `43f28ff…`: `pnpm --filter @ticket/mobile test` → **220 pass / 0 fail** (~16s) |
| Reviewer độc lập ≠ implementer | **Met** — dispatch/session này |

## Findings

### Blocker

Không.

### Known gap (không nuốt gate scheme/CI của PR)

1. **Chưa device / Simulator live OIDC sign-in→callback→logout trên tip** — PR ghi optional. Evidence đủ: unit + realm redirect allowlist + CI mobile. Gap không tuyên bố pilot device auth; coordinator merge theo gate integration riêng nếu cần smoke thiết bị.

### Nit

2. Graph `detect_changes` trên worktree reval (HEAD ≠ tip) trả noise BE/web — bỏ qua; verdict neo source tip + CI + tests trên SHA trên.
3. PR checklist gợi ý `reviewer-security` cho redirect URI — DoD này đã đối chiếu allowlist realm + PKCE không đổi; coordinator có thể spawn `reviewer-security` song song nếu muốn gate riêng (không bắt buộc để đóng DoD scheme/tests của PR này).

## Security / authz (nhẹ, trong scope DoD)

- Public client + PKCE giữ nguyên; chỉ đổi scheme redirect đã có trong realm JSON.
- Dual scheme Expo vẫn đăng ký → deep link legacy không gãy; login path chuyển sang `vemoki://` đã allowlist.
- Không mock auth production; không đổi token verification BE.

## Verdict rationale

Tip `43f28ff…` khớp mục tiêu O13-host-independent: redirect login căn brand với logout, issuer/privacy tests chặn nhầm apex/`app.`, CI mobile + 220 unit pass trên exact SHA, realm `ticket-mobile` đã list `vemoki://oauth/*`. **PASS with known gap** (chưa live device OIDC). Reviewer **không merge**.
