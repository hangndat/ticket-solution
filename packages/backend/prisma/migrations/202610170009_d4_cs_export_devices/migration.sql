-- D4: CS export jobs (MinIO private objects) + attendee device tokens for APNs.

CREATE TABLE exports (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  format text NOT NULL DEFAULT 'csv',
  status text NOT NULL DEFAULT 'PENDING',
  filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_count integer,
  object_key text,
  error_code text,
  expires_at timestamptz,
  client_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exports_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT exports_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT exports_actor_fk FOREIGN KEY (actor_user_id)
    REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT exports_format_chk CHECK (format IN ('csv')),
  CONSTRAINT exports_status_chk CHECK (
    status IN ('PENDING', 'PROCESSING', 'READY', 'FAILED')
  )
);

CREATE UNIQUE INDEX exports_idempotency_unique
  ON exports (tenant_id, event_id, actor_user_id, client_key)
  WHERE client_key IS NOT NULL;

CREATE INDEX exports_claim_idx ON exports (status, created_at);

ALTER TABLE exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports FORCE ROW LEVEL SECURITY;

CREATE POLICY exports_isolation ON exports TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON exports TO ticket_runtime;

-- Cross-tenant claim for worker (no PII in return set).
CREATE OR REPLACE FUNCTION claim_exports_batch(
  p_limit integer,
  p_lease_owner text
)
RETURNS TABLE (
  export_id uuid,
  tenant_id uuid,
  event_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 20 THEN
    RAISE EXCEPTION 'invalid claim limit';
  END IF;
  IF p_lease_owner IS NULL OR length(p_lease_owner) < 1 OR length(p_lease_owner) > 128 THEN
    RAISE EXCEPTION 'invalid lease owner';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT e.id, e.tenant_id
    FROM public.exports e
    WHERE e.status = 'PENDING'
    ORDER BY e.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ),
  updated AS (
    UPDATE public.exports e
    SET status = 'PROCESSING',
        updated_at = clock_timestamp()
    FROM candidates c
    WHERE e.tenant_id = c.tenant_id AND e.id = c.id
    RETURNING e.id, e.tenant_id, e.event_id
  )
  SELECT u.id, u.tenant_id, u.event_id FROM updated u;
END;
$$;

REVOKE ALL ON FUNCTION claim_exports_batch(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_exports_batch(integer, text) TO ticket_runtime;

-- Device tokens are user-scoped (like users), not tenant-scoped.
CREATE TABLE device_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  token text NOT NULL,
  environment text NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_tokens_env_chk CHECK (
    environment IN ('sandbox', 'production')
  ),
  CONSTRAINT device_tokens_token_len_chk CHECK (
    char_length(token) >= 16 AND char_length(token) <= 512
  )
);

CREATE UNIQUE INDEX device_tokens_user_token_unique
  ON device_tokens (user_id, token)
  WHERE revoked_at IS NULL;

CREATE INDEX device_tokens_user_active_idx
  ON device_tokens (user_id)
  WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON device_tokens TO ticket_runtime;
