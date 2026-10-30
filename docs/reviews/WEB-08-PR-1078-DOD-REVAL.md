# WEB-08 DoD revalidation — PR #1078 / Issue #1037

- Reviewer: James (`reviewer-dod`), session `0858b06b-1832-43b6-b64a-75a9fcc937e4`; independent of Linh fix dispatch `ctx_849814ebb508`.
- Verdict: **FAIL** on exact HEAD `77a6a7e7c5db3c94c61e6f68e6dc2b0cef1f2cd1` for WEB-08 P0 B/H/R. Previous review SHA `f5bfb6493c4b726cbb0c4b895a407758faf947d8`; automatic fix iteration 1/2.
- Scope: diff from previous SHA in `tests/e2e/web/mailpit.ts`, `redeem.spec.ts`, fixtures, coverage/report, and adjacent regression. Architecture impact: Không; security review outside dispatch scope.
- Runtime evidence: clean targeted E2E `mvuyn4d9-296c6f` PASS 1/1, tested code SHA `e1c6c22e6b2bf5ecdbb45a583adcf153a8844586`, `workingTreeDirty=false`, `evidenceExactShaEligible=true`; `pnpm test:e2e:guards` 16/16 reported on that SHA. HEAD delta from tested code is only worklog and evidence docs; no runtime/test code change. `gh pr checks 1078`: `ci` and `changes` pass, other jobs skipped.

## Findings

- **WEB08-DOD-01 / F01 — Đã xác minh đóng.** `redeem.spec.ts` logs in independent verified `otherAttendee` in a fresh context, requests owner BFF detail and requires 403/404 without ticket ID, opens the same Mailpit URL, then requires forbidden/missing/tenant-unresolved UI with no ready state, ticket ID, or QR. Guest and owner assertions remain. The clean targeted run exercised this path.
- **WEB08-DOD-02 / F02 — Mở, blocker acceptance.** `mailpit.ts:68–80` checks `Content-ID: <ticket-qr@vemoki>` anywhere in raw MIME, then separately matches an `image/png` base64 span and PNG signature. The regex can cross MIME boundaries; a MIME message with the CID on one part and PNG bytes on another still passes. Thus the test does not prove that the *referenced* `ticket-qr` attachment has PNG bytes. Closure: parse/bound a single MIME part, assert that same part has `Content-ID: <ticket-qr@vemoki>`, `Content-Type: image/png`, and nonempty decoded PNG bytes; rerun targeted WEB-08 on clean exact SHA.

Existing owner/guest, worker, PG exactly-once checks are unchanged and the targeted run passes. Mailpit proves delivery to the run-owned SMTP sink, not an external inbox or read receipt. `coverage.json` `covered` and full B/H/R report remain premature until F02 closes.
