-- Global identity mapping (issuer, subject). Not tenant-scoped; do not use withTenant.
-- Runtime role remains NOSUPERUSER NOBYPASSRLS; FORCE RLS applies.
CREATE TABLE users (
  id uuid PRIMARY KEY,
  issuer text NOT NULL,
  subject text NOT NULL,
  email text,
  email_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_issuer_subject_key UNIQUE (issuer, subject)
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- Identity trust boundary is JWT verification in the API, not tenant context.
-- ticket_runtime may read/write users without app.tenant_id.
CREATE POLICY users_runtime ON users TO ticket_runtime
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON users FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO ticket_runtime;
