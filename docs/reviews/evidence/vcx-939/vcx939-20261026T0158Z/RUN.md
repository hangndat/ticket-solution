# VCX-939 runtime evidence — `vcx939-20261026T0158Z`

| Field | Value |
| --- | --- |
| Issue | [#939](https://github.com/hangndat/ticket-solution/issues/939) |
| PR | [#954](https://github.com/hangndat/ticket-solution/pull/954) |
| reviewedSHA | Chưa review packet này |
| Worker-reported testedSHA | `3ef94f89b89ee519e98344eefe69c82450ccc406` |
| prior testedSHA label | `e76414a120e9a60ca687b47b4a5afe1f1ea66c2f` (retained) |
| Worker | Linh · web |
| Provenance | `runtime-provenance.json` (SHA, ports, OIDC client, fixture DB) |

## Isolated stack (vs Noah926 `3013` / `3498` / `8080`)

| Service | Loopback |
| --- | --- |
| Web | `http://localhost:3417` |
| API | `http://127.0.0.1:3539` |
| OIDC | `http://127.0.0.1:8180/realms/ticket` |
| Mailpit UI | `http://127.0.0.1:8039` (SMTP `1039`) |

Fixture DB `ticket_ui869_dev` on Postgres `:55439`. Harness: `apps/web/.uat-artifacts/vcx-939/run-runtime-uat.py`, `run-vcx939-scenarios.py`.

## Mandatory scenarios

| Scenario | Expected | Actual | Evidence |
| --- | --- | --- | --- |
| Form submit probe (input + BFF + UI) | Code retained; BFF resolve; denied UX | **PASS** — Orca `fill [data-testid=redeem-global-code]` + `click [data-testid=redeem-global-resolve]`; UI «Mã không hợp lệ» with `DEMO-NOT-FOUND` retained; parallel API log `CODE_INVALID` | `api-transitions.sanitized.jsonl`, `screenshots/redeem-form-submit-probe-390.png` |
| pending → issued | Pending then issued after staff approve | **PARTIAL** — API `PENDING_REVIEW` → approve → ticket `b4f15618-…` (`DEMO-V939-PEND-ISSUE-2`); browser pending panel not stable; wallet poll not re-verified on this pass | `api-transitions.sanitized.jsonl`, `screenshots/redeem-pending-390.png`, `redeem-issued-after-poll-1024.png` |
| pending → rejected | Rejected after staff deny | **PASS** — API `REJECTED` for `DEMO-V939-PEND-REJECT`; browser shows rejection copy | `api-transitions.sanitized.jsonl`, `screenshots/redeem-rejected-1024.png` |
| timeout/5xx → unknown | Unknown UX, not denied | **GAP** — API stop during resolve; screenshot lacks `redeem-ux-unknown` / «chưa xác định» | `screenshots/redeem-unknown-outage-390.png` |
| email failure after issuance | Ticket/wallet persist; retry no duplicate | **GAP** — isolated stack has no `apps/worker` notification processor in this run; SMTP fault on API alone insufficient per AC | `manifest.json` limitation retained |

## OIDC harness (`refresh_after_logout_all`)

| Check | Result | Owner |
| --- | --- | --- |
| `pnpm uat:p4-oidc` @ 3539/8180/3417 | **FAIL** `refresh_after_logout_all` (refresh still HTTP 200 after admin logout-all) | **environment** — isolated Keycloak realm; not `apps/web` regression; do not broaden auth product fix in this PR |

## Commands (sanitized)

```sh
# Stack (correct vcx-939 ports — required)
UI869_DEV_STATE_DIR=.local-dev/vcx-939 \
  UI869_WEB_PORT=3417 UI869_API_PORT=3539 UI869_OIDC_PORT=8180 \
  UI869_POSTGRES_PORT=55439 UI869_MINIO_API_PORT=9039 UI869_MINIO_CONSOLE_PORT=9040 \
  UI869_MAILPIT_SMTP_PORT=1039 UI869_MAILPIT_UI_PORT=8039 \
  ./scripts/dev-local-stack.sh up

WEB_BASE_URL=http://localhost:3417 API_BASE_URL=http://127.0.0.1:3539 \
  OIDC_ISSUER=http://127.0.0.1:8180/realms/ticket \
  OIDC_REDIRECT_URI=http://localhost:3417/api/auth/callback \
  python3 apps/web/.uat-artifacts/vcx-939/run-vcx939-scenarios.py
```

Fixture helper (manual MANUAL codes routing): `backfillCodeRoutingFromRedemptionCodes` + insert `DEMO-V939-PEND-ISSUE-2` (harness-only, not product).

## Acceptance

Runtime acceptance **not complete** — F-939-05 remains open (unknown outage UX, email-outbox/worker retry, full pending→issued browser poll). No `apps/web` product code changes in this dispatch (harness + evidence only).
