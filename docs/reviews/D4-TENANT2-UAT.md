# D4 Tenant-2 — headless UAT evidence

**Gate (ROADMAP D4):** second tenant self-creates event/brand via admin UI — not hardcoded FUN FEST.  
**Ownership:** `apps/web` (+ this script). **Does not claim D4 parent Hoàn thành.**

## What the script proves

Runnable entrypoint:

```bash
node apps/web/tests/d4-tenant2-uat.mjs [baseUrl]
# default base: http://127.0.0.1:13040
# or: WEB_UAT_BASE=http://127.0.0.1:3000 node apps/web/tests/d4-tenant2-uat.mjs
```

| Check | Pass criteria |
| --- | --- |
| `/admin` no FUN FEST | HTML for create-event flow must not contain `FUN FEST` / `fun-fest` |
| Create-event (non-pilot) | When Keycloak + API + optional `DATABASE_URL` fixture are up (`D4_UAT_MODE=full` or `auto`): login → empty tenant/membership fixture only → **Tạo event** succeeds (`Đã tạo event`) |
| Create-event fail-closed | When OIDC/API down or full path unavailable: notice matches `OIDC_MISCONFIGURED` / `UNAUTHENTICATED` / `chưa biết` / `PERMISSION` / `EVENT_*` — never silently claims success |
| `/platform` smoke | Either fail-closed banner (`Platform OIDC chưa cấu hình`) when `PLATFORM_OIDC_*` unset, **or** visible **Tạo tenant** UI + notice after click |

Related heavier path (full CS/export): `node apps/web/tests/admin-tenant2-e2e.mjs`  
Anonymous admin fail-closed smoke: `node apps/web/tests/admin-uat.mjs`

### Env

| Var | Role |
| --- | --- |
| `WEB_UAT_BASE` | Web origin (default `http://127.0.0.1:13040`) |
| `D4_UAT_MODE` | `auto` (default) \| `fail-closed` \| `full` |
| `KEYCLOAK_BASE` | Probe + login (default `http://127.0.0.1:18040`) |
| `DATABASE_URL` | Optional `psql` for **empty** tenant + membership only (no event seed) |
| `TENANT2_ID` | Non-pilot tenant UUID |
| `UAT_STAFF_USER` / `UAT_STAFF_PASS` | Keycloak staff for full mode |
| `WEB_UAT_EXECUTABLE` | Override chrome-headless-shell |

Artifacts (gitignored): `apps/web/.uat-artifacts/d4-tenant2-uat.log`, `d4-tenant2-uat-evidence.json`, screenshots `d4-tenant2-*.png`.

## What still needs human / operator browser UAT

- Real **platform operator MFA** bootstrap (`PLATFORM_OIDC_*` + ACR) and live **Tạo tenant** → PENDING + owner invite (not SQL).
- Keycloak users that are not the local demo `staff@example.com` / production IdP.
- Brand/config publish + import + CS/export on a freshly operator-created tenant (beyond create-event).
- Cross-browser / headed visual check only if a human asks to watch (`WEB_UAT_HEADED=1` is opt-in; default remains headless).

## Run record (this workspace)

| Field | Value |
| --- | --- |
| Script | `apps/web/tests/d4-tenant2-uat.mjs` |
| Mode | `auto` |
| Base | `http://127.0.0.1:13041` (this-worktree `next dev`; contracts built) |
| Verdict | **PASS with known gap** |
| Checks | platform fail-closed HTTP 200 · no FUN FEST · create-event fail-closed (`chưa biết`) |
| Limitations | `PLATFORM_OIDC` unset (no live MFA Tạo tenant); WEB OIDC unset → no full Keycloak create this run; external stack on `:13040` was unhealthy for interactive create |
| Artifacts (gitignored) | `apps/web/.uat-artifacts/d4-tenant2-uat.log`, `d4-tenant2-uat-evidence.json`, `d4-tenant2-*-failclosed.png` |
| Tip SHA | branch `hangndat/d4-tenant2-uat` — exact SHA trên PR tip (`git rev-parse HEAD`) |

SQL may only provision empty tenant/membership fixture — never seed events as “proof.”  
**Không tuyên bố D4 parent Hoàn thành** từ gate headless này.
