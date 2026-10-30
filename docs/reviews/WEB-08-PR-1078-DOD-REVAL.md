# WEB-08 DoD revalidation — PR #1078

- Reviewer: James (`reviewer-dod`); independent of implementer Linh.
- Verdict: **FAIL** for full WEB-08 P0 B/H/R on exact HEAD `f5bfb6493c4b726cbb0c4b895a407758faf947d8`; tested code commit `bef4f36955604886a13ab042e227b1c566bc7c57` is unchanged by HEAD (HEAD changes only `coverage.json` and `REPORT.md`).
- Evidence: isolated run `mvuy8ksx-56d1a3` PASS 1/1, `summary.json` clean and `evidenceExactShaEligible=true` at `bef4f369`; `pnpm test:e2e:guards` PASS 16/16 at HEAD. PR CI was pending at review time.

## Confirmed

`redeem.spec.ts` uses the Web UI with a verified Keycloak attendee, checks wallet and a single PostgreSQL ticket/request/operation/`TicketIssued` outbox plus quota allocation, polls the run Mailpit sink, and opens the mail link as guest and owner. The guest sees the login state; the owner sees the matching ticket ID and QR figure. The report correctly limits Mailpit evidence to the local SMTP sink and does not claim Internet inbox delivery or a read receipt.

## Findings

### WEB08-DOD-01 — authenticated non-owner link access unproved (P0)

Repro: inspect `tests/e2e/web/redeem.spec.ts:1082–1101`. The only denied-link context is unauthenticated; it checks `owner-ticket-need-login-state`. An authenticated different attendee is never given the same URL, so a route that requires login but leaks the ticket to any logged-in actor would pass. Closure: login an independent fixture attendee in a fresh browser context, open the exact mail URL, assert forbidden/missing UI, no ticket ID or QR, and HTTP/BFF denial without owner data; rerun on a clean exact SHA.

### WEB08-DOD-02 — QR in captured email unproved (P0)

Repro: `tests/e2e/web/mailpit.ts:74–84` checks that HTML contains `cid:ticket-qr` but does not inspect Mailpit attachment metadata or bytes. A dangling CID reference without a QR image would pass. Closure: assert the referenced inline attachment exists in Mailpit with image/png content and nonempty bytes (or inspect the rendered Mailpit MIME content), then rerun on a clean exact SHA.

`coverage.json` marking WEB-08 `covered` and `REPORT.md` claiming full B/H/R are premature until both findings close. No product or test files were changed during this review.
