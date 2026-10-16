-- D2: inventory, redemption, tickets, operations, outbox, notifications, audit.
-- PostgreSQL is source of truth for quota/issue; Redis must not decide quota.
-- Run as migration owner; ticket_runtime stays NOSUPERUSER NOBYPASSRLS.

-- Event policy fields used by issue windows (FOR SHARE in issue txn).
ALTER TABLE events
  ADD COLUMN status text NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  ADD COLUMN redemption_opens_at timestamptz,
  ADD COLUMN redemption_closes_at timestamptz;

ALTER TABLE events
  ADD CONSTRAINT events_status_chk CHECK (status IN ('DRAFT', 'PUBLISHED', 'CLOSED'));

CREATE TABLE ticket_types (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  id uuid NOT NULL,
  label text NOT NULL,
  entitlement_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_types_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT ticket_types_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE issuance_sources (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  id uuid NOT NULL,
  name text NOT NULL,
  approval_mode text NOT NULL DEFAULT 'AUTO',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT issuance_sources_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT issuance_sources_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT issuance_sources_approval_mode_chk CHECK (approval_mode IN ('AUTO', 'MANUAL'))
);

CREATE TABLE source_ticket_types (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  source_id uuid NOT NULL,
  ticket_type_id uuid NOT NULL,
  CONSTRAINT source_ticket_types_pkey PRIMARY KEY (tenant_id, source_id, ticket_type_id),
  CONSTRAINT source_ticket_types_source_fk FOREIGN KEY (tenant_id, source_id)
    REFERENCES issuance_sources(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT source_ticket_types_type_fk FOREIGN KEY (tenant_id, ticket_type_id)
    REFERENCES ticket_types(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT source_ticket_types_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT
);

-- scope: EVENT | TICKET_TYPE | ISSUANCE_SOURCE; scope_id null only for EVENT.
CREATE TABLE quota_buckets (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  id uuid NOT NULL,
  scope text NOT NULL,
  scope_id uuid,
  capacity integer,
  allocated integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quota_buckets_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT quota_buckets_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT quota_buckets_scope_chk CHECK (scope IN ('EVENT', 'TICKET_TYPE', 'ISSUANCE_SOURCE')),
  CONSTRAINT quota_buckets_scope_id_chk CHECK (
    (scope = 'EVENT' AND scope_id IS NULL) OR
    (scope <> 'EVENT' AND scope_id IS NOT NULL)
  ),
  CONSTRAINT quota_buckets_allocated_chk CHECK (
    allocated >= 0 AND (capacity IS NULL OR allocated <= capacity)
  ),
  CONSTRAINT quota_buckets_scope_unique UNIQUE (tenant_id, event_id, scope, scope_id)
);

CREATE TABLE redemption_codes (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  id uuid NOT NULL,
  code_hmac text NOT NULL,
  code_pepper_version integer NOT NULL DEFAULT 1,
  source_id uuid NOT NULL,
  ticket_type_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'AVAILABLE',
  active_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT redemption_codes_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT redemption_codes_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT redemption_codes_source_fk FOREIGN KEY (tenant_id, source_id)
    REFERENCES issuance_sources(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT redemption_codes_type_fk FOREIGN KEY (tenant_id, ticket_type_id)
    REFERENCES ticket_types(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT redemption_codes_status_chk CHECK (
    status IN ('AVAILABLE', 'HELD', 'CONSUMED', 'DISABLED')
  ),
  CONSTRAINT redemption_codes_hmac_unique UNIQUE (tenant_id, event_id, code_hmac)
);

CREATE TABLE event_attendees (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  canonical_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_attendees_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT event_attendees_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT event_attendees_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT event_attendees_user_unique UNIQUE (tenant_id, event_id, user_id)
);

CREATE TABLE attendee_counters (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  attendee_id uuid NOT NULL,
  issued_count integer NOT NULL DEFAULT 0,
  max_tickets integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendee_counters_pkey PRIMARY KEY (tenant_id, attendee_id),
  CONSTRAINT attendee_counters_attendee_fk FOREIGN KEY (tenant_id, attendee_id)
    REFERENCES event_attendees(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT attendee_counters_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT attendee_counters_issued_chk CHECK (
    issued_count >= 0 AND (max_tickets IS NULL OR issued_count <= max_tickets)
  )
);

CREATE TABLE redemption_requests (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  redemption_code_id uuid NOT NULL,
  status text NOT NULL,
  form_version text,
  terms_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT redemption_requests_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT redemption_requests_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT redemption_requests_actor_fk FOREIGN KEY (actor_user_id)
    REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT redemption_requests_code_fk FOREIGN KEY (tenant_id, redemption_code_id)
    REFERENCES redemption_codes(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT redemption_requests_status_chk CHECK (
    status IN (
      'PENDING_VERIFICATION',
      'PENDING_REVIEW',
      'PROCESSING',
      'ISSUED',
      'REJECTED',
      'EXPIRED'
    )
  )
);

CREATE TABLE tickets (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  ticket_type_id uuid NOT NULL,
  source_id uuid NOT NULL,
  request_id uuid NOT NULL,
  redemption_code_id uuid,
  state text NOT NULL DEFAULT 'ACTIVE',
  credential_version integer NOT NULL DEFAULT 1,
  entitlement_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tickets_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT tickets_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT tickets_owner_fk FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT tickets_type_fk FOREIGN KEY (tenant_id, ticket_type_id)
    REFERENCES ticket_types(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT tickets_source_fk FOREIGN KEY (tenant_id, source_id)
    REFERENCES issuance_sources(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT tickets_request_fk FOREIGN KEY (tenant_id, request_id)
    REFERENCES redemption_requests(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT tickets_code_fk FOREIGN KEY (tenant_id, redemption_code_id)
    REFERENCES redemption_codes(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT tickets_request_unique UNIQUE (tenant_id, request_id),
  CONSTRAINT tickets_state_chk CHECK (
    state IN ('ACTIVE', 'REVOKED', 'CANCELLED', 'USED')
  )
);

CREATE UNIQUE INDEX tickets_code_issued_unique
  ON tickets (tenant_id, redemption_code_id)
  WHERE redemption_code_id IS NOT NULL AND state = 'ACTIVE';

CREATE TABLE ticket_credentials (
  tenant_id uuid NOT NULL,
  ticket_id uuid NOT NULL,
  version integer NOT NULL,
  kid text NOT NULL,
  token_hash text NOT NULL,
  encrypted_token text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_credentials_pkey PRIMARY KEY (tenant_id, ticket_id, version),
  CONSTRAINT ticket_credentials_ticket_fk FOREIGN KEY (tenant_id, ticket_id)
    REFERENCES tickets(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT ticket_credentials_status_chk CHECK (status IN ('ACTIVE', 'REVOKED'))
);

-- Idempotency operations (TD §8.1). Unique per tenant/event/actor/command/key.
CREATE TABLE operations (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  command text NOT NULL,
  client_key text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL DEFAULT 'IN_PROGRESS',
  response_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT operations_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT operations_actor_fk FOREIGN KEY (actor_user_id)
    REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT operations_scope_key_unique UNIQUE (
    tenant_id, event_id, actor_user_id, command, client_key
  ),
  CONSTRAINT operations_status_chk CHECK (
    status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')
  )
);

CREATE TABLE outbox (
  tenant_id uuid NOT NULL,
  event_id uuid,
  id uuid NOT NULL,
  type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload_version integer NOT NULL DEFAULT 1,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING',
  attempts integer NOT NULL DEFAULT 0,
  lease_owner text,
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outbox_pkey PRIMARY KEY (id),
  CONSTRAINT outbox_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT outbox_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT outbox_status_chk CHECK (
    status IN ('PENDING', 'LEASED', 'PROCESSING', 'COMPLETE', 'DEAD')
  )
);

CREATE INDEX outbox_due_idx ON outbox (status, lease_expires_at, created_at)
  WHERE status IN ('PENDING', 'LEASED', 'PROCESSING');

CREATE TABLE notifications (
  tenant_id uuid NOT NULL,
  event_id uuid,
  id uuid NOT NULL,
  business_key text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  state text NOT NULL DEFAULT 'PENDING',
  provider_ref text,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT notifications_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT notifications_business_key_unique UNIQUE (tenant_id, business_key),
  CONSTRAINT notifications_state_chk CHECK (
    state IN ('PENDING', 'SENT', 'FAILED', 'DEAD')
  )
);

CREATE TABLE audit_logs (
  tenant_id uuid NOT NULL,
  event_id uuid,
  id uuid NOT NULL,
  actor_user_id uuid,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  reason text,
  sanitized_diff jsonb,
  operation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT audit_logs_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE INDEX tickets_owner_idx ON tickets (tenant_id, owner_user_id);
CREATE INDEX redemption_codes_lookup_idx ON redemption_codes (tenant_id, event_id, code_hmac);
CREATE INDEX operations_actor_idx ON operations (tenant_id, event_id, actor_user_id, command, client_key);

-- RLS: FORCE on all tenant-scoped tables.
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types FORCE ROW LEVEL SECURITY;
ALTER TABLE issuance_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE issuance_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE source_ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_ticket_types FORCE ROW LEVEL SECURITY;
ALTER TABLE quota_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_buckets FORCE ROW LEVEL SECURITY;
ALTER TABLE redemption_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemption_codes FORCE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees FORCE ROW LEVEL SECURITY;
ALTER TABLE attendee_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendee_counters FORCE ROW LEVEL SECURITY;
ALTER TABLE redemption_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemption_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets FORCE ROW LEVEL SECURITY;
ALTER TABLE ticket_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations FORCE ROW LEVEL SECURITY;
-- ENABLE without FORCE: SECURITY DEFINER claim_outbox_batch (owned by migration
-- role) must see all tenants; ticket_runtime still hits the isolation policy.
ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY ticket_types_isolation ON ticket_types TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY issuance_sources_isolation ON issuance_sources TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY source_ticket_types_isolation ON source_ticket_types TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY quota_buckets_isolation ON quota_buckets TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY redemption_codes_isolation ON redemption_codes TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY event_attendees_isolation ON event_attendees TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY attendee_counters_isolation ON attendee_counters TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY redemption_requests_isolation ON redemption_requests TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY tickets_isolation ON tickets TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY ticket_credentials_isolation ON ticket_credentials TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY operations_isolation ON operations TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY outbox_isolation ON outbox TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY notifications_isolation ON notifications TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY audit_logs_isolation ON audit_logs TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON ticket_types, issuance_sources, source_ticket_types, quota_buckets,
  redemption_codes, event_attendees, attendee_counters, redemption_requests,
  tickets, ticket_credentials, operations, outbox, notifications, audit_logs
  FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON ticket_types, issuance_sources, source_ticket_types,
  quota_buckets, redemption_codes, event_attendees, attendee_counters, redemption_requests,
  tickets, ticket_credentials, operations, outbox, notifications, audit_logs
  TO ticket_runtime;

-- Cross-tenant outbox claim: narrow SECURITY DEFINER, fixed search_path, no dynamic SQL.
-- Returns lease batch without PII; worker then opens withTenant per row to process.
CREATE OR REPLACE FUNCTION claim_outbox_batch(
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
  payload_version integer
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
    WHERE o.status = 'PENDING'
       OR (o.status IN ('LEASED', 'PROCESSING')
           AND o.lease_expires_at IS NOT NULL
           AND o.lease_expires_at < clock_timestamp())
    ORDER BY o.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ),
  updated AS (
    UPDATE public.outbox o
    SET status = 'LEASED',
        lease_owner = p_lease_owner,
        lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
        attempts = o.attempts + 1,
        updated_at = clock_timestamp()
    FROM candidates c
    WHERE o.id = c.id
    RETURNING o.id, o.tenant_id, o.event_id, o.type, o.aggregate_id, o.payload_version
  )
  SELECT u.id, u.tenant_id, u.event_id, u.type, u.aggregate_id, u.payload_version
  FROM updated u;
END;
$$;

REVOKE ALL ON FUNCTION claim_outbox_batch(integer, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_outbox_batch(integer, text, integer) TO ticket_runtime;
