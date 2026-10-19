-- MPR-T1 / K-API-01: platform catalog reads ADR-19 published public events only.
-- ticket_platform_runtime may SELECT matching rows cross-tenant; drafts stay invisible.

CREATE POLICY events_platform_published ON events
  FOR SELECT
  TO ticket_platform_runtime
  USING (
    visibility = 'PUBLIC'
    AND content_status = 'PUBLISHED'
    AND business_status = 'ACTIVE'
    AND published_config_version IS NOT NULL
  );

CREATE POLICY event_config_versions_platform_published ON event_config_versions
  FOR SELECT
  TO ticket_platform_runtime
  USING (
    published_at IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM events e
      WHERE e.tenant_id = event_config_versions.tenant_id
        AND e.id = event_config_versions.event_id
        AND e.visibility = 'PUBLIC'
        AND e.content_status = 'PUBLISHED'
        AND e.business_status = 'ACTIVE'
        AND e.published_config_version = event_config_versions.version
    )
  );

GRANT SELECT ON events TO ticket_platform_runtime;
GRANT SELECT ON event_config_versions TO ticket_platform_runtime;
