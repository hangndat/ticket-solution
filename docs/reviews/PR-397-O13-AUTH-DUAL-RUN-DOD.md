# DoD review — PR #397 (O13 dual-run Keycloak/compose auth audit)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor `reviewer-dod` (+ OIDC security mindset) · terminal `term_93625a16-a2b0-4d34-90cc-cf4e0acb0723` · task `task_72a6985e609b` · dispatch `ctx_833aa3d38a2b` (≠ implementer) |
| Scope | PR [#397](https://github.com/hangndat/ticket-solution/pull/397) · branch `hangndat/d13-bug-ops-o13-audit` · `infra/keycloak/realm-ticket.json`, `infra/deploy/*`, `docs/ops/ENV-MANIFEST.md`, `apps/web/.env.example`, `apps/web/tests/platform-shape.test.ts`, `docs/reviews/O13-AUTH-DUAL-RUN-AUDIT.md` |
| Commit SHA reviewed | `b49225ad4841bb8c3c52697809ebdbb8e632d8e8` (tip; confirmed `gh pr view 397 --json headRefOid`) |
| Behavioral SHA | `f9d7a59a648c1531b6116b4cbb69a5da2634e065` (realm/compose/env patches); tip adds artifact SHA cite only |
| Architecture impact | Có — dual-run O13 IdP/nginx/compose alignment; **không** đổi IdP provider |
| Decision IDs | O13 (`docs/architecture/o13-marketing-app-subdomain.md`) · dual-run phase (apex retained) |
| Verdict | **PASS with known gap** |

## Checks (on tip SHA)

| Check | Result |
| --- | --- |
| CI [39130580104](https://github.com/hangndat/ticket-solution/actions/runs/39130580104) | **changes** SUCCESS · **web** SUCCESS · **d5-*** SUCCESS · **ci** SUCCESS · backend/mobile/database-isolation SKIPPED (paths) |
| Live logout redirect (ops already applied) | `curl` KC end-session `post_logout_redirect_uri=https://app.vemoki.com/auth` → **302** `https://app.vemoki.com/auth` |
| Live BFF logout emit | `GET https://app.vemoki.com/api/auth/logout` → 307 → KC logout with `client_id=ticket-web` + `post_logout_redirect_uri=https://app.vemoki.com/auth` |
| Apex `/auth` | 302 → `https://app.vemoki.com/auth` |
| Secrets | Diff/examples: no live secrets committed; `.env.example` placeholders only |

## Correctness vs AC

1. **Realm dual-run** — `ticket-web` / `ticket-admin-web` / `ticket-platform-web` gain `app.` redirectUris + webOrigins; `post.logout.redirect.uris` include `https://app.vemoki.com/auth` (+ apex for dual-run). No `*` wildcards.
2. **Platform clientId** — docs/tests/compose default `ticket-platform-web` (matches live KC; removes stale `ticket-platform`). Compose maps `PLATFORM_OIDC_*` + `WEB_PUBLIC_ORIGIN` → product host defaults.
3. **Platform callback paths** — code path `/api/auth/platform/callback` added; legacy `/api/platform/auth/callback` retained (dual-run).
4. **Audit artifact** — `docs/reviews/O13-AUTH-DUAL-RUN-AUDIT.md` documents live probes + residual risks; tip SHA cite present.

## Security (OIDC)

- Redirect / post-logout allowlists are **explicit host+path** (apex + `app.` + localhost) — not open redirect.
- Confidential clients remain `publicClient: false`; no client secrets introduced in repo.
- Live fix for empty `PLATFORM_OIDC_CLIENT_ID` restores fail-closed platform OIDC config path (was silently misconfigured).
- Dual-run still trusts apex origins — intentional until O13 contract phase; not a regression vs handoff.

## Findings

| Severity | Finding |
| --- | --- |
| known gap (intentional) | Apex still in redirect/webOrigins/post.logout — dual-run; **Phase 3 contract** must remove apex product client URIs. |
| known gap (intentional) | Legacy platform callback `/api/platform/auth/callback` still allowlisted — remove when no consumers. |
| nit | Implementer audit notes `ticket-admin-web` callback mirror unclear in `apps/web/app/api` — out of this PR; track separately if admin BFF path drifts. |
| — | No blocker / should-fix for merge of this ops alignment PR. |

## Limitations

- Reviewer did **not** re-run kcadm against live IdP (relied on audit artifact + independent HTTP probes).
- Local `platform-shape.test.ts` runner unavailable in this worktree; **CI web job green on tip** is the acceptance check.

## Merge note

**Coordinator may merge** after board process. Reviewer did **not** merge. Revalidate if tip SHA moves with behavior changes.
