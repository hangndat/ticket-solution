-- D4: store the staff denial reason on the redemption request.
-- One open PENDING_REVIEW row per code so a second hold cannot bind the same code.

ALTER TABLE redemption_requests
  ADD COLUMN decision_reason text;

CREATE UNIQUE INDEX redemption_requests_one_pending
  ON redemption_requests (tenant_id, redemption_code_id)
  WHERE status = 'PENDING_REVIEW';
