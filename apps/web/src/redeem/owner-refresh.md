# Owner refresh boundary

`owner-status.ts` remains the transport and validation boundary for authenticated, tenant-scoped owner status reads. `owner-refresh.ts` owns the scoped request, generation check, localized outcome, raw response and state transition plan. `RedeemForm` applies the current outcome to its React state.

Issued status still produces the existing `issued` decision and active ticket shape. Pending review leaves the request untouched; rejected and expired statuses clear the pending request and decision. Unauthorized and transport/scope failures remain handled by `fetchOwnerRedemptionStatus` and the form's existing localized error path.

Coverage is in `tests/owner-redemption-scope.test.ts`, including scope query preservation, missing scope, BFF scope rejection, unauthorized response, stale-generation suppression and terminal versus pending transitions.
