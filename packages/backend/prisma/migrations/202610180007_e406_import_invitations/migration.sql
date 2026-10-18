-- E406 H-I1/H-I2: CSV import jobs (MinIO quarantine) + guest invitations.
-- Preview/dispatch never allocate quota; commit CODES inserts AVAILABLE codes only.

CREATE TABLE import_files (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  id uuid NOT NULL,
  kind text NOT NULL,
  object_key text NOT NULL,
  file_hash text NOT NULL,
  byte_length integer NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CONSTRAINT import_files_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT import_files_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT import_files_author_fk FOREIGN KEY (created_by)
    REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT import_files_kind_chk CHECK (kind IN ('CODES', 'GUESTS')),
  CONSTRAINT import_files_bytes_chk CHECK (byte_length > 0 AND byte_length <= 10485760),
  CONSTRAINT import_files_object_key_uq UNIQUE (object_key)
);

CREATE INDEX import_files_event_idx
  ON import_files (tenant_id, event_id, created_at);
CREATE INDEX import_files_expire_idx
  ON import_files (expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE import_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_files FORCE ROW LEVEL SECURITY;

CREATE POLICY import_files_isolation ON import_files TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON import_files TO ticket_runtime;

CREATE TABLE import_jobs (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  id uuid NOT NULL,
  kind text NOT NULL,
  status text NOT NULL,
  source_id uuid NOT NULL,
  ticket_type_id uuid NOT NULL,
  file_id uuid,
  file_hash text,
  raw_codes_json jsonb,
  mapping_revision integer,
  column_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview_revision integer,
  valid_row_count integer,
  error_row_count integer,
  invitation_count integer,
  estimated_quota integer,
  sample_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_report_csv text,
  error_report_expires_at timestamptz,
  commit_response jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT import_jobs_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT import_jobs_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT import_jobs_source_fk FOREIGN KEY (tenant_id, source_id)
    REFERENCES issuance_sources(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT import_jobs_type_fk FOREIGN KEY (tenant_id, ticket_type_id)
    REFERENCES ticket_types(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT import_jobs_file_fk FOREIGN KEY (tenant_id, file_id)
    REFERENCES import_files(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT import_jobs_author_fk FOREIGN KEY (created_by)
    REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT import_jobs_kind_chk CHECK (kind IN ('CODES', 'GUESTS')),
  CONSTRAINT import_jobs_status_chk CHECK (
    status IN ('CREATED', 'PREVIEW_READY', 'COMMITTING', 'COMPLETED', 'FAILED')
  ),
  CONSTRAINT import_jobs_payload_chk CHECK (
    file_id IS NOT NULL OR raw_codes_json IS NOT NULL
  )
);

CREATE INDEX import_jobs_event_idx
  ON import_jobs (tenant_id, event_id, created_at DESC);

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs FORCE ROW LEVEL SECURITY;

CREATE POLICY import_jobs_isolation ON import_jobs TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON import_jobs TO ticket_runtime;

CREATE TABLE guest_invitations (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  id uuid NOT NULL,
  import_job_id uuid,
  source_id uuid NOT NULL,
  ticket_type_id uuid NOT NULL,
  invited_email text NOT NULL,
  token_hash text NOT NULL,
  state text NOT NULL,
  expires_at timestamptz NOT NULL,
  claimed_by uuid,
  claimed_at timestamptz,
  redemption_code_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guest_invitations_pkey PRIMARY KEY (tenant_id, id),
  CONSTRAINT guest_invitations_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT guest_invitations_job_fk FOREIGN KEY (tenant_id, import_job_id)
    REFERENCES import_jobs(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT guest_invitations_source_fk FOREIGN KEY (tenant_id, source_id)
    REFERENCES issuance_sources(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT guest_invitations_type_fk FOREIGN KEY (tenant_id, ticket_type_id)
    REFERENCES ticket_types(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT guest_invitations_claim_user_fk FOREIGN KEY (claimed_by)
    REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT guest_invitations_code_fk FOREIGN KEY (tenant_id, redemption_code_id)
    REFERENCES redemption_codes(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT guest_invitations_state_chk CHECK (
    state IN ('PENDING', 'DISPATCHED', 'CLAIMED', 'EXPIRED', 'REVOKED')
  ),
  CONSTRAINT guest_invitations_token_uq UNIQUE (token_hash),
  CONSTRAINT guest_invitations_email_event_uq UNIQUE (tenant_id, event_id, invited_email)
);

CREATE INDEX guest_invitations_event_state_idx
  ON guest_invitations (tenant_id, event_id, state, created_at DESC);

ALTER TABLE guest_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY guest_invitations_isolation ON guest_invitations TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON guest_invitations TO ticket_runtime;

CREATE TABLE invitation_dispatch_previews (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  preview_revision integer NOT NULL,
  invitation_ids uuid[] NOT NULL,
  estimated_quota integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitation_dispatch_previews_pkey
    PRIMARY KEY (tenant_id, event_id, actor_user_id, preview_revision),
  CONSTRAINT invitation_dispatch_previews_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT invitation_dispatch_previews_actor_fk FOREIGN KEY (actor_user_id)
    REFERENCES users(id) ON DELETE RESTRICT
);

ALTER TABLE invitation_dispatch_previews ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_dispatch_previews FORCE ROW LEVEL SECURITY;

CREATE POLICY invitation_dispatch_previews_isolation
  ON invitation_dispatch_previews TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON invitation_dispatch_previews TO ticket_runtime;
