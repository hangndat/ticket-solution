-- D4: append-only event config versions. Payload never changes after insert.
-- published_at may be set once. Publishing does not rewrite issued tickets.

CREATE TABLE event_config_versions (
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  version integer NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  payload jsonb NOT NULL,
  author_user_id uuid NOT NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_config_versions_pkey PRIMARY KEY (tenant_id, event_id, version),
  CONSTRAINT event_config_versions_version_chk CHECK (version > 0),
  CONSTRAINT event_config_versions_event_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES events(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT event_config_versions_author_fk FOREIGN KEY (author_user_id)
    REFERENCES users(id) ON DELETE RESTRICT
);

ALTER TABLE events
  ADD COLUMN published_config_version integer;

ALTER TABLE events
  ADD CONSTRAINT events_published_config_fk FOREIGN KEY (
    tenant_id, id, published_config_version
  ) REFERENCES event_config_versions(tenant_id, event_id, version) ON DELETE RESTRICT;

CREATE FUNCTION event_config_versions_append_only() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.payload IS DISTINCT FROM OLD.payload
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.schema_version IS DISTINCT FROM OLD.schema_version
     OR NEW.author_user_id IS DISTINCT FROM OLD.author_user_id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.event_id IS DISTINCT FROM OLD.event_id THEN
    RAISE EXCEPTION 'config version is append-only';
  END IF;
  IF OLD.published_at IS NOT NULL
     AND NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    RAISE EXCEPTION 'published config is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER event_config_versions_append_only
  BEFORE UPDATE ON event_config_versions
  FOR EACH ROW
  EXECUTE FUNCTION event_config_versions_append_only();

ALTER TABLE event_config_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_config_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY event_config_versions_isolation ON event_config_versions TO ticket_runtime
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON event_config_versions TO ticket_runtime;
