# D12 BE release-verify — O06 anonymize + RLS / Keycloak assurance

| Field | Value |
| --- | --- |
| Issue | #295 (Epic #293) |
| Branch | `hangndat/d12-backend-o06-anonymize` |
| Impl SHA (anonymize) | `0f6deb78863cb6ca8c7ac5b04383ccea2f6e56fd` |
| Tip SHA | f1b557ff20bf5b39a08f4358b358aa5d3d0760bf |
| Base `origin/main` (lúc verify) | `d7fba8bbcc7d082ed9287e5c2966e72cd2700cba` |
| Reviewer session | _(DoD reviewer độc lập — chưa)_ |
| productionClaim | **false** (local Compose + isolated Docker Postgres) |

## 1. Database isolation / NOBYPASSRLS

Chạy local trên worktree (path filter CI sẽ chạy `database-isolation` khi PR đụng `packages/backend`):

```bash
pnpm --filter @ticket/contracts build
pnpm --filter @ticket/backend build
cd packages/backend
node --test test/platform.test.cjs          # PASS — O06 REQUESTED + anonymize + audit giữ nguyên
node --test test/rls-catalog.test.cjs       # PASS — FORCE RLS + owner allowlist + NOBYPASSRLS
```

Compose Postgres (`ticket_dev` / `ticket_solution`) probe:

```text
rolname                  | rolbypassrls | rolsuper
ticket_platform_runtime  | f            | f
ticket_runtime           | f            | f
```

`ticket_platform_app` chưa có trên DB Compose này (không fail closed cho gate local).

## 2. Keycloak assurance smoke

```bash
./scripts/platform-keycloak-assurance-smoke.sh
# issuer: http://127.0.0.1:8080/realms/ticket (shared Compose)
```

| Check | Result |
| --- | --- |
| `platform-security-config-smoke` | PASS |
| Attendee password grant `aud` | PASS — `['ticket-api']`, **không** có `ticket-platform-api` |
| Admin / platform password grant | PASS — HTTP 400 (blocked) |
| Live MFA `acr=2` (`platform-keycloak-mfa-live-proof.mjs`) | **FAIL local** — `acr want 2 got 1` → script exit 1 |
| Full `PLATFORM_KEYCLOAK_ASSURANCE_SMOKE_PASS` | **không** đạt trên realm shared này |

**Kết luận assurance:** audience tách biệt mobile/attendee vs platform **đã chứng minh local**. MFA step-up `acr=2` **chưa** chứng minh trên shared Compose → không claim production MFA.

Ghi chú: `security-config` smoke vẫn in `o06=UNRESOLVED` (flag security-config ≠ DECISION-LOG O06 đã chốt 2026-10-18).

## 3. O06 account anonymize (scope #295)

- ACK `REQUESTED` + `policy_version=O06-2026-10-18` (không còn `AWAITING_POLICY` / `UNRESOLVED`).
- Worker poll: `processDueAccountAnonymizations` (SECURITY DEFINER list/apply).
- Anonymize: clear `users.email`, rotate `subject` → `anon:<requestId>`, revoke device tokens, null `event_attendees.canonical_email`; **không** DELETE `audit_logs` / `platform_audit_logs`.
- Retention stubs 365d / 90d: `processDueTicketPiiAnonymizations` / `processDueObjectRetentions` → `NO_JOB_FRAMEWORK` (YAGNI).

## 4. Limitations

- `packages/contracts` `AccountDeletionRequestResponse` vẫn type-literal `AWAITING_POLICY` / `UNRESOLVED` — sync contract/web/mobile ngoài scope BE này.
- Ticket PII 365d + object 90d chưa có job claim table.
- MFA `acr=2` live proof fail trên realm shared; cần task-stack / realm MFA enroll để pass full smoke.
- **productionClaim: false** — không drill VPS / không deploy.

## 5. Verdict (implementer self-check)

| Gate | Status |
| --- | --- |
| Anonymize pipeline + Postgres tests | PASS (local) |
| RLS catalog / NOBYPASSRLS roles | PASS (local) |
| Keycloak attendee ≠ `ticket-platform-api` | PASS (local) |
| Keycloak MFA `acr=2` full smoke | FAIL / known gap local |
| Production ready | **No** (`productionClaim: false`) |
