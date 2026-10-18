# D13 — Web store companion UAT (S2-T3 / S5-T3)

**Epic:** [#301](https://github.com/hangndat/ticket-solution/issues/301)  
**Tasks:** [#321](https://github.com/hangndat/ticket-solution/issues/321) (S2-T3), [#330](https://github.com/hangndat/ticket-solution/issues/330) (S5-T3)  
**Role:** `web` · Architecture impact: **Không**  
**Worker tip SHA (điền sau commit):** 8dc9abbfb6434ef7960e4ad5a6ee2e108073239e  
**Local UAT ≠ production deploy.** Prod ASC URLs checked HTTP-only; enriched copy lands after merge+deploy.

---

## Scope done

1. Enrich public privacy VI/EN: session/ticket/device-push collection, camera **on-device** (no photo upload), retention O06, account-deletion path (`/account` + iOS Account), contact; **no job/scheduler/enforce claims** on the page (coordinator: `policy-only-no-enforce-claim`).
2. Support VI/EN: contact `support@vemoki.com` + SLA O06 (already present; lead clarifies privacy follow-up).
3. Account web path: remove stale “O06 chưa chốt”; align copy to O06 ≤30d anonymize / not immediate erase.
4. Headless UAT via `scripts/web-uat.sh screenshot` (Playwright headless) + HTTP matrix on local `next start --port 3013`.

---

## Disclosure map (O06 / nutrition)

| Topic | Where | Notes |
| --- | --- | --- |
| Data: session / ticket / device push | `privacy.s1` | Matches nutrition categories; no ads tracking claim |
| Camera on-device, no upload | `privacy.s3` | Policy disclosure only (iOS Gate) |
| Retention ≤30d / 365d / 730d / 90d | `privacy.s4` | O06 numbers |
| Account deletion in-app/web path | `privacy.s5` + `/account` | User language; ACK ≠ immediate erase |
| Contact | `privacy.s7` + `/support` | `support@vemoki.com` / privacy alias when ready |
| Enforce / prod anonymize E2E | **Not claimed** | BE PR342 `8bc744e0c765…` has local worker anonymize tests; security review still open (Keycloak account / staff_sessions). No prod deletion E2E |

---

## Commands & results

```bash
pnpm --filter @ticket/contracts build
cd apps/web && pnpm exec tsx --test tests/*.test.ts
# → 207 pass / 0 fail

pnpm --filter @ticket/web build
pnpm --filter @ticket/web exec next start --port 3013

# HTTP matrix (local next start :3013) — all 200:
# /privacy /en/privacy /support /en/support /account /redeem /en /auth
# /t/demo/events/demo (published event shell; not authenticated ticket wallet)

./scripts/web-uat.sh screenshot http://127.0.0.1:3013/privacy apps/web/.uat-artifacts/d13-companion/privacy-vi.png
# (+ en/privacy, support, en/support, account, redeem, en)
```

**Artifacts (gitignored):** `apps/web/.uat-artifacts/d13-companion/*.png`

**Prod ASC URLs (read-only, 2026-10-18):**

| URL | Status |
| --- | --- |
| `https://vemoki.com/privacy` | 200 |
| `https://vemoki.com/en/privacy` | 200 |
| `https://vemoki.com/support` | 200 |

Prod HTML still reflects **pre-enrichment** copy until this PR is merged and deployed (not authorized in this task).

---

## Pending board updates (rate limit)

GitHub GraphQL Project edits hit **RATE_LIMIT** for user `6947674` during run. Pending coordinator sync:

| Issue | Item ID | Desired Status |
| --- | --- | --- |
| #321 | `PVTI_lAHOAGoDWs4BnWaNzhBk3g4` | `Chờ duyệt` (`0544c261`) after PR |
| #330 | `PVTI_lAHOAGoDWs4BnWaNzhBk5HI` | `Chờ duyệt` (`0544c261`) after PR |

Do **not** mark board success until root resets quota and applies edits.

---

## Limitations

- Local Playwright UAT on port **3013** with production `next start` — not prod host.
- Authenticated redeem/ticket issuance / account-deletion POST not exercised (needs task-specific OIDC+API); public surfaces + account form shell smoke only.
- Account deletion **policy** disclosed; **runtime enforce** depends on BE S2-T2 + security gaps (see coordinator ask reply).
- No merge / no prod deploy from this worker.
