# D13 — BUG email ticket flow UAT (prod, headless)

| Field | Value |
| --- | --- |
| Role | `reviewer-dod` (UAT/evidence) — session ≠ implementer web/BE |
| Role path | `docs/agents/roles/reviewer-dod.md` |
| Agent | `cursor` |
| Architecture impact | **Không** |
| Run / Task / Dispatch | `run_1d13e6e391a0` / `task_dab578506bc2` / `ctx_6d087781c14c` |
| Reviewed at (UTC) | `2026-10-18T13:07:32Z` |
| Exact SHA tip `main` lúc chạy | **`d16ee368c68b2a6de12a6461e94acd8208dda192`** (`git rev-parse origin/main`) |
| Worktree HEAD | `d16ee368c68b2a6de12a6461e94acd8208dda192` (same) |
| Target email link | `https://app.vemoki.com/t/uat-device/tickets/97f77680-4d65-4b6d-baf3-b3f699a006a6` |
| Verdict (end-to-end owner email → web view) | **FAIL** — missing web ticket page (HTTP **404**) |
| Verdict (this UAT task DoD) | **PASS with known gap** — matrix + headless evidence complete; SMTP/CS/DB ACCEPTED **not re-verified** this session (no VPS/DB); prior durable ops still Mailpit/Porkbun-creds gap |

## 1. Flow matrix (prod facts)

| # | Step | Result | Evidence / notes |
| --- | --- | --- | --- |
| 1 | SMTP internet (Porkbun `:587`) configured on prod worker | **NOT RE-VERIFIED** (open) | Latest durable ops: `docs/reviews/D13-S2-T1-RUNTIME-REVAL-2026-10-18.md` — Worker `SMTP_URL` host still **`smtp://mailpit`**; `PILOT-GATES-2026-10-18.md` — Porkbun `:587` reachable but mailbox creds missing at last check. This reviewer session: **no** `/opt/vemoki` env, **no** SSH host for VPS. **Do not claim Porkbun ACCEPTED from this run.** |
| 2 | CS resend (admin) enqueues / replays TicketIssued email | **NOT RE-VERIFIED** (open) | No prod DB / CS session in this dispatch. Code path exists: `apps/web/app/api/bff/admin/tickets/[ticketId]/resend/route.ts` → Nest CS resend. |
| 3 | `notifications.state` / providerStatus **ACCEPTED** (SMTP provider accept ≠ inbox DELIVERED) | **NOT RE-VERIFIED** (open) | Prior Mailpit requeue ACCEPTED (`455090a7-…`) in PILOT-GATES; **not** proven for ticket `97f77680-…` or Porkbun. ADR-12: ACCEPTED ≠ delivered. |
| 4 | Email `ticketLink` shape matches BE contract | **PASS** (source + sibling audit) | `buildOwnerTicketLink` → `{PUBLIC_WEB_BASE_URL}/t/{tenantSlug}/tickets/{ticketId}` (`packages/backend/src/qr-ticket.ts`). Sibling BE audit: `docs/reviews/D13-BUG-BE-TICKET-LINK-AUDIT.md` (worktree `d13-bug-be-ticket-link-audit`). Target URL matches that contract for tenant `uat-device` + ticket UUID above. |
| 5 | Open email link in browser (anonymous) | **FAIL** | HTTP **404**; UI `data-testid="route-not-found"` — “Không tìm thấy trang”. |
| 6 | Owner ticket page exists on web | **FAIL** | Source: only `apps/web/app/t/[tenantSlug]/events/[eventSlug]/page.tsx` under `/t/…`. **No** `…/tickets/[ticketId]/page.tsx`. Control: `/t/uat-device/events/demo` → **200** (tenant slug resolves for events). |
| 7 | OIDC login redirect (`app` → `auth`) | **PASS** (this run) | `GET /api/auth/login` → Keycloak `https://auth.vemoki.com/realms/ticket/protocol/openid-connect/auth?client_id=ticket-web&redirect_uri=https%3A%2F%2Fapp.vemoki.com%2Fapi%2Fauth%2Fcallback…` · Playwright title `Sign in to Vemoki`. `/auth` **200**; anonymous `/api/bff/me` **401**. |

### HTTP probe (email link)

```text
URL: https://app.vemoki.com/t/uat-device/tickets/97f77680-4d65-4b6d-baf3-b3f699a006a6
http_code=404
url_effective=(same; no redirect)
content_type=text/html; charset=utf-8
x-powered-by=Next.js
```

Saved: `apps/web/.uat-artifacts/d13-bug-email-ticket/ticket-link-headers.txt`, `ticket-link-response.html`.

## 2. Headless UAT (no desktop mouse)

Commands run on SHA `d16ee368c68b2a6de12a6461e94acd8208dda192` (after `pnpm install` so root `playwright@1.56.1` resolves):

```bash
git rev-parse origin/main
# d16ee368c68b2a6de12a6461e94acd8208dda192

mkdir -p apps/web/.uat-artifacts/d13-bug-email-ticket

curl -sS -D apps/web/.uat-artifacts/d13-bug-email-ticket/ticket-link-headers.txt \
  -o apps/web/.uat-artifacts/d13-bug-email-ticket/ticket-link-response.html \
  -A "Vemoki-UAT-Reviewer/1.0" \
  "https://app.vemoki.com/t/uat-device/tickets/97f77680-4d65-4b6d-baf3-b3f699a006a6"

./scripts/web-uat.sh goto \
  "https://app.vemoki.com/t/uat-device/tickets/97f77680-4d65-4b6d-baf3-b3f699a006a6"
# {"ok":true,"status":404,"url":"…/tickets/97f77680-…","title":"Vemoki"}

./scripts/web-uat.sh screenshot \
  "https://app.vemoki.com/t/uat-device/tickets/97f77680-4d65-4b6d-baf3-b3f699a006a6" \
  "apps/web/.uat-artifacts/d13-bug-email-ticket/ticket-link-404.png"

./scripts/web-uat.sh screenshot \
  "https://app.vemoki.com/" \
  "apps/web/.uat-artifacts/d13-bug-email-ticket/app-home.png"

./scripts/web-uat.sh auth-smoke "https://app.vemoki.com"
# authStatus=200 signInVisible=true bffMeStatus=401

./scripts/web-uat.sh goto "https://app.vemoki.com/auth"
# status=200 title="Đăng nhập · Vemoki"

./scripts/web-uat.sh goto "https://app.vemoki.com/api/auth/login"
# final URL auth.vemoki.com … redirect_uri=https://app.vemoki.com/api/auth/callback

./scripts/web-uat.sh screenshot \
  "https://app.vemoki.com/api/auth/login" \
  "apps/web/.uat-artifacts/d13-bug-email-ticket/oidc-signin.png"

./scripts/web-uat.sh goto "https://app.vemoki.com/t/uat-device/events/demo"
# status=200 title="Sự kiện · Vemoki"
```

**Forbidden paths not used:** cliclick, AppleScript clicks, `ORCA computer click`, headed Chrome (`WEB_UAT_HEADED` unset).

### Headless evidence paths (gitignored under `apps/web/.uat-artifacts/`)

| Artifact | Path |
| --- | --- |
| META (UTC + SHA) | `apps/web/.uat-artifacts/d13-bug-email-ticket/META.txt` |
| Ticket link headers | `apps/web/.uat-artifacts/d13-bug-email-ticket/ticket-link-headers.txt` |
| Ticket link HTML body | `apps/web/.uat-artifacts/d13-bug-email-ticket/ticket-link-response.html` |
| Ticket link 404 PNG | `apps/web/.uat-artifacts/d13-bug-email-ticket/ticket-link-404.png` |
| App home PNG | `apps/web/.uat-artifacts/d13-bug-email-ticket/app-home.png` |
| Auth smoke PNG | `apps/web/.uat-artifacts/d13-bug-email-ticket/auth-smoke.png` |
| OIDC login goto JSON | `apps/web/.uat-artifacts/d13-bug-email-ticket/oidc-login-goto.json` |
| OIDC sign-in PNG | `apps/web/.uat-artifacts/d13-bug-email-ticket/oidc-signin.png` |

## 3. Open gates (còn mở)

| Gate | Status | Note |
| --- | --- | --- |
| **Missing ticket page** | **OPEN / FAIL** | BE email contract `/t/{tenant}/tickets/{id}` with **no** App Router page. Primary blocker for owner email → web view. Fix ownership: **web** (ship page at current BE path; do **not** silent-change BE URL — see BE audit). |
| **SMTP Porkbun / secret rotation** | **OPEN** | Ops still on Mailpit per last durable reval. Rotation note for coordinator/ops: set `SMTP_URL`/`SMTP_FROM` via secure channel on VPS only; **rotate** submission password after any leak/share; **never** commit or paste secrets into Issue/PR/chat. This artifact intentionally **does not** print credentials. |
| **CS resend → notification ACCEPTED (prod)** | **OPEN** | Needs VPS/DB or CS authenticated smoke after SMTP live; out of scope for this headless web-only reviewer without DB access. |
| **account_deletion GRANT / `migration_owner` (prod hotfix)** | **OPEN** (not re-verified on prod DB) | Source has `POLICY account_deletion_owner … TO migration_owner` (`202610170012_d4_platform_m01`) and FORCE RLS; **no** explicit `GRANT … ON account_deletion_requests TO migration_owner` in that migration (only `ticket_runtime`). Coordinator-listed prod hotfix remains open until ops confirms SECURITY DEFINER / owner grants on live DB. |
| **OIDC redirect** | **CLOSED for this probe** | Login start + Keycloak UI + `redirect_uri=https://app.vemoki.com/api/auth/callback` observed healthy. Re-open only if a new broken redirect is reported after web/auth deploy. |

## 4. Related handoffs

- BE link audit (same Run): sibling worktree `d13-bug-be-ticket-link-audit` → `docs/reviews/D13-BUG-BE-TICKET-LINK-AUDIT.md` — contract lock `/t/{tenant}/tickets/{id}`, no silent URL change.
- API health (context): `https://api.vemoki.com/v1/health` → `{"status":"ok","service":"api"}` HTTP 200.

## 5. Acceptance checklist

- [x] Flow matrix PASS/FAIL (or NOT RE-VERIFIED) từng bước — §1
- [x] Headless evidence paths — §2
- [x] Exact commands + SHA tip `main` — header + §2
- [x] Open gates listed — §3 (no secrets printed)

## 6. Findings for coordinator

1. **Blocker:** Ship web owner ticket page at `/t/[tenantSlug]/tickets/[ticketId]` (auth-gated as product requires) before claiming email-ticket E2E PASS.
2. **Do not** flip BE `buildOwnerTicketLink` to another path until that page is live (emails already using current shape).
3. **SMTP/CS ACCEPTED** still need an ops/DB evidence row (notification id + state) after Porkbun creds; this UAT cannot close that gate.
4. Revalidation required on any new tip that changes ticket routes or auth redirect hosts.
