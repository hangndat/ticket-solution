# VCX-939 evidence delta — vcx939-20261026T0418Z

**Exact SHA:** `314a5ac008cbec5f77fed79171ce72f4fd619c30` (PR #954). **Prior packet:** `vcx939-20261026T0305Z` (labels unchanged). **Acceptance:** Partial — F-939-05 narrowed, not closed.

## Delta vs review comment 6407409140

| Finding | Delta on this SHA | Artifact |
| --- | --- | --- |
| Upstream **hang** (not connection refused) | **PASS transport + latency.** `upstream-hang-proxy.py` accepts TCP on API port, never responds. Health probe during hang: client timeout ~2.5s (not instant `ECONNREFUSED`). Authenticated `POST …/redemptions` during hang: `curl` exit 28, **25016 ms** elapsed (`upstream-hang-timing.json`). BFF configured upstream timeout remains **20s** (`apps/web/src/bff/upstream.ts`). | `upstream-hang-timing.json`, `upstream-hang-proxy.py`, `upstream-hang-timeout.json` |
| BFF hang → UI unknown + operation key | **GAP (automation).** Orca `eval`/`click` did not toggle React terms consent (`checked=false` in snapshots); `requestSubmit` did not emit `/api/bff/redeem` during hang (`bffTrace` empty). Wall wait ~22s is not proof of BFF completion. **502 refusal unknown UX** from `0305Z` request chain + a11y snapshots still authoritative for UI copy/retry. | `upstream-hang-timeout.json`; cross-ref `vcx939-20261026T0305Z/browser-request-chain.sanitized.json`, `unknown-502-a11y-from-0305Z.snapshot.txt` |
| Outcome panel PNG 390/1024/1440 | **PARTIAL.** New shots under `screenshots/outcomes/` use `scrollIntoView` on `redeem-ux-*` / headings; this dispatch did not reliably reach post-submit panels (terms/submit automation). **A11y outcome text** for pending/issued/rejected/unknown (502) copied from validated `0305Z` for reviewer cross-check (`*-a11y-from-0305Z.snapshot.txt`). Resolve-step outage UI captured: `unknown-502.snapshot.txt` («Không kết nối được» on resolve). | `outcome-panels.json`, `screenshots/outcomes/*`, `*-a11y-from-0305Z.snapshot.txt` |
| F-939-03 claim pending→rejected | Not attempted (nonblocking, timebox). | — |

## Harness (local only)

- Ports unchanged: web `3417`, API `3539`, OIDC `8180`, Mailpit only; no SMTP/logout/full matrix rerun.
- Scripts: `apps/web/.uat-artifacts/vcx-939/probe-bff-hang-curl.py`, `probe-hang-only.py`, `probe-outcome-*.py`, `upstream-hang-proxy.py`.

## Checks

- `git rev-parse HEAD` → `314a5ac008cbec5f77fed79171ce72f4fd619c30`
- `sha256sum -c manifest.sha256` on this folder after publish.
