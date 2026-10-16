-- D3 check-in gate: staff session, reservation hold, current check-in, undo.
-- Expiry is applied under the ticket lock (TD §9.2). Partial indexes do not
-- call now(); a hold stays HELD until a mutation expires it.

CREATE TABLE staff_sessions (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT staff_sessions_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT staff_sessions_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT staff_sessions_user_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT staff_sessions_status_chk CHECK (status IN ('ACTIVE', 'REVOKED'))
);

CREATE TABLE checkin_reservations (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  id uuid NOT NULL,
  ticket_id uuid NOT NULL,
  staff_session_id uuid NOT NULL,
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'HELD',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT checkin_reservations_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT checkin_reservations_ticket_fk FOREIGN KEY (tenant_id, ticket_id)
    REFERENCES tickets(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT checkin_reservations_session_fk FOREIGN KEY (tenant_id, staff_session_id)
    REFERENCES staff_sessions(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT checkin_reservations_status_chk CHECK (
    status IN ('HELD', 'CONFIRMED', 'EXPIRED', 'RELEASED')
  )
);

CREATE UNIQUE INDEX checkin_reservations_one_held
  ON checkin_reservations (tenant_id, ticket_id)
  WHERE status = 'HELD';

CREATE TABLE checkins (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  id uuid NOT NULL,
  ticket_id uuid NOT NULL,
  reservation_id uuid NOT NULL,
  staff_session_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  undone_at timestamptz,
  undo_reason text,
  undone_by uuid,
  CONSTRAINT checkins_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT checkins_ticket_fk FOREIGN KEY (tenant_id, ticket_id)
    REFERENCES tickets(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT checkins_reservation_fk FOREIGN KEY (tenant_id, reservation_id)
    REFERENCES checkin_reservations(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT checkins_session_fk FOREIGN KEY (tenant_id, staff_session_id)
    REFERENCES staff_sessions(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT checkins_actor_fk FOREIGN KEY (actor_user_id)
    REFERENCES users(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX checkins_one_current
  ON checkins (tenant_id, ticket_id)
  WHERE undone_at IS NULL;

ALTER TABLE staff_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE checkin_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_reservations FORCE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins FORCE ROW LEVEL SECURITY;

CREATE POLICY staff_sessions_isolation ON staff_sessions TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY checkin_reservations_isolation ON checkin_reservations TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY checkins_isolation ON checkins TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON staff_sessions, checkin_reservations, checkins
  TO ticket_runtime;
