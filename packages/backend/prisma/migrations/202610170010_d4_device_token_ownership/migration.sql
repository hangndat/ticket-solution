-- One active owner per APNs device token (account switch reassigns atomically).
CREATE UNIQUE INDEX device_tokens_token_active_unique
  ON device_tokens (token)
  WHERE revoked_at IS NULL;
