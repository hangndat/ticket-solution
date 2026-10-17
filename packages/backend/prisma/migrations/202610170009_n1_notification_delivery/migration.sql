-- N1: email MIME delivery, append-only attempts, channel lease fencing,
-- versioned templates, rate caps. Keep PostgreSQL leased outbox as MVP queue
-- (no BullMQ). ACCEPTED ≠ end-user delivered.

-- Outbox lease fencing token (stale workers cannot ack a newer lease).
ALTER TABLE outbox
  ADD COLUMN IF NOT EXISTS lease_token text,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;

-- Migrate notification state SENT → ACCEPTED (provider accepted, not delivered).
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_state_chk;
UPDATE notifications SET state = 'ACCEPTED' WHERE state = 'SENT';
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'TicketIssued',
  ADD COLUMN IF NOT EXISTS payload_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS template_version integer,
  ADD COLUMN IF NOT EXISTS lease_owner text,
  ADD COLUMN IF NOT EXISTS lease_token text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_state_chk CHECK (
    state IN ('PENDING', 'ACCEPTED', 'FAILED', 'DEAD', 'UNKNOWN')
  );
ALTER TABLE notifications
  ADD CONSTRAINT notifications_channel_chk CHECK (
    channel IN ('email', 'push')
  );
ALTER TABLE notifications
  ADD CONSTRAINT notifications_kind_chk CHECK (
    kind IN (
      'TicketIssued',
      'InvitationReady',
      'EventChanged',
      'EventCancelled',
      'EventReminder'
    )
  );

CREATE TABLE notification_attempts (
  tenant_id uuid NOT NULL,
  notification_id uuid NOT NULL,
  ordinal integer NOT NULL,
  channel text NOT NULL,
  lease_owner text,
  lease_token text,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz,
  provider_status text NOT NULL,
  provider_ref text,
  sanitized_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_attempts_pkey PRIMARY KEY (tenant_id, notification_id, ordinal),
  CONSTRAINT notification_attempts_notification_fk
    FOREIGN KEY (tenant_id, notification_id)
    REFERENCES notifications(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT notification_attempts_channel_chk CHECK (channel IN ('email', 'push')),
  CONSTRAINT notification_attempts_status_chk CHECK (
    provider_status IN ('PENDING', 'ACCEPTED', 'FAILED', 'DEAD', 'UNKNOWN')
  ),
  CONSTRAINT notification_attempts_ordinal_chk CHECK (ordinal >= 1)
);

CREATE INDEX notification_attempts_notification_idx
  ON notification_attempts (tenant_id, notification_id, ordinal);

ALTER TABLE notification_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_attempts FORCE ROW LEVEL SECURITY;
CREATE POLICY notification_attempts_isolation ON notification_attempts TO ticket_runtime
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
GRANT SELECT, INSERT ON notification_attempts TO ticket_runtime;

-- Versioned notification templates (literal + allowlisted variables).
CREATE TABLE notification_templates (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  id uuid NOT NULL,
  kind text NOT NULL,
  published_version integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_templates_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT notification_templates_event_fk
    FOREIGN KEY (tenant_id, event_id) REFERENCES events(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT notification_templates_kind_chk CHECK (
    kind IN (
      'TicketIssued',
      'InvitationReady',
      'EventChanged',
      'EventCancelled',
      'EventReminder'
    )
  ),
  CONSTRAINT notification_templates_event_kind_unique UNIQUE (tenant_id, event_id, kind)
);

CREATE TABLE notification_template_versions (
  tenant_id uuid NOT NULL,
  template_id uuid NOT NULL,
  version integer NOT NULL,
  subject text NOT NULL,
  body_text text NOT NULL,
  body_html text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_template_versions_pkey
    PRIMARY KEY (tenant_id, template_id, version),
  CONSTRAINT notification_template_versions_template_fk
    FOREIGN KEY (tenant_id, template_id)
    REFERENCES notification_templates(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT notification_template_versions_version_chk CHECK (version >= 1),
  CONSTRAINT notification_template_versions_subject_len CHECK (char_length(subject) <= 200),
  CONSTRAINT notification_template_versions_body_text_len CHECK (char_length(body_text) <= 20000),
  CONSTRAINT notification_template_versions_body_html_len CHECK (char_length(body_html) <= 40000)
);

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE notification_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_template_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY notification_templates_isolation ON notification_templates TO ticket_runtime
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY notification_template_versions_isolation ON notification_template_versions TO ticket_runtime
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
GRANT SELECT, INSERT, UPDATE ON notification_templates TO ticket_runtime;
GRANT SELECT, INSERT ON notification_template_versions TO ticket_runtime;

-- Atomic rate-limit counters (staff resend / recipient / tenant).
CREATE TABLE notification_rate_counters (
  tenant_id uuid NOT NULL,
  bucket_key text NOT NULL,
  window_started_at timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_rate_counters_pkey PRIMARY KEY (tenant_id, bucket_key, window_started_at),
  CONSTRAINT notification_rate_counters_count_chk CHECK (count >= 0)
);

ALTER TABLE notification_rate_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rate_counters FORCE ROW LEVEL SECURITY;
CREATE POLICY notification_rate_counters_isolation ON notification_rate_counters TO ticket_runtime
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
GRANT SELECT, INSERT, UPDATE ON notification_rate_counters TO ticket_runtime;

-- Claim sets lease_token for fencing; returns token to worker.
DROP FUNCTION IF EXISTS claim_outbox_batch(integer, text, integer);

CREATE FUNCTION claim_outbox_batch(
  p_limit integer,
  p_lease_owner text,
  p_lease_seconds integer DEFAULT 30
)
RETURNS TABLE (
  outbox_id uuid,
  tenant_id uuid,
  event_id uuid,
  type text,
  aggregate_id uuid,
  payload_version integer,
  lease_token text,
  attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'invalid claim limit';
  END IF;
  IF p_lease_owner IS NULL OR length(p_lease_owner) < 1 OR length(p_lease_owner) > 128 THEN
    RAISE EXCEPTION 'invalid lease owner';
  END IF;
  IF p_lease_seconds IS NULL OR p_lease_seconds < 5 OR p_lease_seconds > 300 THEN
    RAISE EXCEPTION 'invalid lease seconds';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT o.id
    FROM public.outbox o
    WHERE (
        o.status = 'PENDING'
        OR (
          o.status IN ('LEASED', 'PROCESSING')
          AND o.lease_expires_at IS NOT NULL
          AND o.lease_expires_at < clock_timestamp()
        )
      )
      AND (o.next_attempt_at IS NULL OR o.next_attempt_at <= clock_timestamp())
    ORDER BY o.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ),
  updated AS (
    UPDATE public.outbox o
    SET status = 'LEASED',
        lease_owner = p_lease_owner,
        lease_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
        lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
        attempts = o.attempts + 1,
        updated_at = clock_timestamp()
    FROM candidates c
    WHERE o.id = c.id
    RETURNING
      o.id,
      o.tenant_id,
      o.event_id,
      o.type,
      o.aggregate_id,
      o.payload_version,
      o.lease_token,
      o.attempts
  )
  SELECT
    u.id,
    u.tenant_id,
    u.event_id,
    u.type,
    u.aggregate_id,
    u.payload_version,
    u.lease_token,
    u.attempts
  FROM updated u;
END;
$$;

REVOKE ALL ON FUNCTION claim_outbox_batch(integer, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_outbox_batch(integer, text, integer) TO ticket_runtime;
