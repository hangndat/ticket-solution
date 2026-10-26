# VCX-939 runtime evidence — `vcx939-20261026T0158Z`

| Field | Value |
| --- | --- |
| Issue | [#939](https://github.com/hangndat/ticket-solution/issues/939) |
| PR | [#954](https://github.com/hangndat/ticket-solution/pull/954) |
| reviewedSHA | Chưa review packet này |
| Worker-reported testedSHA | `e76414a120e9a60ca687b47b4a5afe1f1ea66c2f`; chưa xác minh build provenance độc lập |
| prior testedSHA label | `d00a265cca1206b68601c75d445b633f7d590b57` (retained as source label) |
| Worker | Linh · web |
| Browser | Orca tab `97cbff48-48f7-491c-90fb-a6a5cbc7f4f7` (closed after run) |

## Isolated stack (vs Noah926 `3013` / `3498` / `8080`)

| Service | Loopback |
| --- | --- |
| Web | `http://localhost:3417` |
| API | `http://127.0.0.1:3539` |
| OIDC | `http://127.0.0.1:8180/realms/ticket` |
| Mailpit UI | `http://127.0.0.1:8039` (SMTP `1039`) |

Fixture DB `ticket_ui869_dev` on Postgres `:55439`. Local-only `apps/web/.env.local` pointed at this stack (gitignored). Symlink `.local-dev/ui869` → `.local-dev/vcx-939` for fixture scripts only.

## Mandatory scenarios

| Scenario | Expected | Actual | Evidence |
| --- | --- | --- | --- |
| pending → issued | Pending UI then issued after staff approve | **Worker báo API PASS — chưa có log trong packet để xác minh độc lập** (`DEMO-V939-PEND-ISSUE` → `APPROVAL_PENDING` → approve → `ISSUED` ticket `38d18d02-…`); **browser poll GAP** (Orca form submit flaky) | API log in worker notes; wallet shows issued ticket |
| pending → rejected | Rejected after staff deny | **Worker báo API PASS — chưa có log trong packet để xác minh độc lập** (`DEMO-V939-PEND-REJECT` → deny → `REJECTED`) | API log |
| timeout/5xx → unknown | Unknown UX, not denied/issued | **GAP** browser (API stopped; resolve did not surface unknown panel—empty code field on 390); **unit PASS** (`redeem-decide`, `redeem-messages`) | `redeem-unknown-390.png` (not valid unknown—honest fail) |
| email failure after issuance | Ticket/wallet persisted; retry no duplicate | **GAP** (SMTP `:19999` API boot attempted; end-to-end relay/retry not completed in bounded time) | Fault noted in `manifest.json` |
| issued success screenshot | Success state, not blank form | **PARTIAL** — resolve+event context `redeem-resolve-1024.png`; **wallet PASS** `wallet-1024.png` (4× «Sẵn sàng», includes manual-approve ticket); **redeem-ux-success panel GAP** | `screenshots/` |

## Commands (sanitized)

- Stack: `UI869_DEV_STATE_DIR=.local-dev/vcx-939 UI869_*_PORT=… ./scripts/dev-local-stack.sh up`
- OIDC HTTP: `OIDC_ISSUER=http://127.0.0.1:8180/… OIDC_REDIRECT_URI=http://localhost:3417/api/auth/callback API_BASE_URL=http://127.0.0.1:3539 pnpm uat:p4-oidc`
- Unit: `pnpm --filter @ticket/web test` @ `e76414a`
- Orca: `orca tab create` → PKCE curl bootstrap → `goto` callback → `/redeem` / `/wallet` → `screenshot`

## Acceptance

Runtime acceptance **not complete** — F-939-05 remains open for full browser proof on pending/rejected poll, unknown outage, email-outbox retry, and redeem success panel. No `apps/web` code changes in this dispatch.
