# DoD Review — O13 auth logout (Keycloak end-session → `app./auth`)

**Reviewer / session:** Orca `reviewer-dod` (+ `reviewer-security` mindset OIDC), Agent Cursor, terminal `term_c312f067-2a18-4df7-9b54-b66f2c9f9e64`, task `task_48a23376ffae`, dispatch `ctx_4c9f55247a81` — độc lập ≠ implementer  
**Scope:** O13 handoff logout/post-logout + live evidence; audit repo tip `infra/keycloak/realm-ticket.json`, web logout route, deploy templates. Không merge; không deploy.  
**PR / sibling:** Không có PR mở từ sibling workers (`d13-bug-ops-o13-audit`, `d13-bug-web-auth-uat`) tại thời điểm review — audit tip + live.  
**Architecture impact:** Có (O13 host split marketing apex vs product `app.`) — đối chiếu [`docs/architecture/o13-marketing-app-subdomain.md`](../architecture/o13-marketing-app-subdomain.md) §4 OIDC redirect / post-logout.  
**Decision IDs:** O13 (GTM host model)

## Exact SHA (đang duyệt)

`63535b48e2f17c65778246e5c44fc162f0dd9f26`  
(`git rev-parse` tip worktree `hangndat/d13-bug-reviewer-auth`; subject: `feat(mobile): O02 ẩn tab Nhân viên theo MeEvents staffEligible (#379)`)

UTC check: `2026-10-18T13:05:26Z`

## Handoff expect (O13 §4)

| Client | post-logout / notes |
| ------ | ------------------- |
| `ticket-web` | post-logout → `https://app.vemoki.com/auth` (via BFF logout); thêm redirect/webOrigin `app.` trước cutover |

## Checks (trên SHA tip + live prod)

| Check | Kết quả |
| ----- | ------- |
| Live apex `GET https://vemoki.com/api/auth/logout` | **302** `Location: https://app.vemoki.com/api/auth/logout` |
| Live product `GET https://app.vemoki.com/api/auth/logout` | **307** → Keycloak end-session `client_id=ticket-web` & `post_logout_redirect_uri=https://app.vemoki.com/auth`; clear `oidc_*` cookies (Expire 1970) |
| Live Keycloak end-session (no prior IdP session) | **302** `Location: https://app.vemoki.com/auth` — khớp handoff «Location app./auth» |
| Live `GET https://app.vemoki.com/auth` | **200** |
| Code `apps/web/app/api/auth/logout/route.ts` @ tip | Clear session cookies → redirect KC logout với `post_logout_redirect_uri = publicOrigin + /auth` — đúng contract BFF |
| `infra/keycloak/realm-ticket.json` @ tip vs handoff | **Drift** — xem findings |
| `infra/deploy/compose.yaml` + `.env.example` @ tip vs handoff | **Drift** — xem findings |

Lệnh evidence (không follow redirect ở bước 1–2):

```bash
curl -sS -D - -o /dev/null --max-time 15 https://vemoki.com/api/auth/logout
curl -sS -D - -o /dev/null --max-time 15 https://app.vemoki.com/api/auth/logout
# follow Location từ bước 2 → expect 302 Location: https://app.vemoki.com/auth
```

## Findings

### PASS (live + BFF route)

1. Chuỗi logout prod thỏa O13 post-logout: apex → app logout → KC → **`https://app.vemoki.com/auth`**.
2. BFF attendee logout xóa cookie session rồi RP-initiated logout (`/protocol/openid-connect/logout`) với `post_logout_redirect_uri` host-aware qua `resolvePublicOrigin`.
3. Nginx apex đã redirect product auth path (`/api/auth/logout`) sang `app.` (302).

### Known gaps / should-fix (repo tip ≠ handoff / IaC)

| # | Severity | Finding |
| - | -------- | ------- |
| G1 | should-fix (ops/IaC) | `ticket-web` trong `realm-ticket.json` **chỉ** có apex `https://vemoki.com/...` — **thiếu** `https://app.vemoki.com/api/auth/callback`, webOrigin `https://app.vemoki.com`, và attribute `post.logout.redirect.uris` cho `https://app.vemoki.com/auth` (dual-run apex cũng không khai báo post-logout). Live KC **đã chấp nhận** redirect → prod realm đã chỉnh ngoài JSON; **re-import tip hiện tại có rủi ro regress** allowlist post-logout / redirect. |
| G2 | should-fix (ops/IaC) | `ticket-platform-web` realm vẫn path cũ `/api/platform/auth/callback` + chỉ apex; code/tests dùng `/api/auth/platform/callback`. Handoff yêu cầu path code + URI `app.`. |
| G3 | should-fix (deploy template) | `infra/deploy/compose.yaml` hardcode `OIDC_REDIRECT_URI: https://vemoki.com/api/auth/callback` và `PUBLIC_WEB_ORIGIN` default apex; **không** set `WEB_PUBLIC_ORIGIN` (tên code đọc). Live logout `app.` đúng nhờ fallback `X-Forwarded-Host` khi `WEB_PUBLIC_ORIGIN` unset — **đúng tình cờ**, không khớp handoff «canonical product origin = app.» / sync tên env. |
| G4 | nit / docs | `infra/deploy/.env.example` + ENV manifest vẫn `PUBLIC_WEB_ORIGIN=https://vemoki.com` / `PUBLIC_WEB_BASE_URL=https://vemoki.com` — chưa phản ánh cutover O13. |

### Security notes (không nâng FAIL)

- Cookie clear host-only (không `Domain=.vemoki.com`) — khớp B2 handoff.
- Attendee logout không gửi `id_token_hint`; với session IdP trống KC vẫn 302 về `app./auth` (đã chứng minh). Session còn sống có thể khác (confirm UI) — ngoài AC «302 Location app./auth» của evidence này.
- Platform logout (`POST /api/auth/platform/logout`) chỉ clear cookie, **không** RP-initiated end-session — ngoài scope attendee O13 logout; ghi nhận.

### Không blocker live

Không phát hiện regression logout user path trên prod tại thời điểm review.

## Verdict

**PASS with known gap**

- **PASS:** live evidence logout → Keycloak → `Location: https://app.vemoki.com/auth`; BFF route tip khớp contract.  
- **Known gaps G1–G3:** repo tip realm + deploy templates **chưa** đồng bộ O13 handoff; phụ thuộc cấu hình live / forwarded-host. Cần ops/coordinator sync realm JSON + compose/`WEB_PUBLIC_ORIGIN`/`OIDC_REDIRECT_URI` → `app.` trước khi coi IaC cutover đóng.  
- Gap **không** nuốt AC live logout; **không** đủ để tuyên bố realm/deploy tip = source of truth O13.

**Không merge / không deploy** trong phiên reviewer này.
