# Owner refresh boundary

`owner-status.ts` remains the transport and validation boundary for authenticated, tenant-scoped owner status reads. `owner-refresh.ts` translates its validated status into a focused UI state plan; `RedeemForm` applies that plan and retains locale-specific feedback, raw response display, and generation checks.

Issued status still produces the existing `issued` decision and active ticket shape. Pending review leaves the request untouched; rejected and expired statuses clear the pending request and decision. Unauthorized and transport/scope failures remain handled by `fetchOwnerRedemptionStatus` and the form's existing localized error path.

Coverage is in `tests/owner-redemption-scope.test.ts`, including scope query preservation, missing scope, BFF scope rejection, unauthorized response, and owner status transition cases. Component-level stale-generation behavior remains guarded in `refreshOwnerStatus` and was not moved into this pure mapping boundary.
