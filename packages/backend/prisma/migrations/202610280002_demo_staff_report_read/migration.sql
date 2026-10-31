-- Demo staff UAT (#880): staff@example.com may own orgs outside D9 stable UUIDs
-- (catalog: Aurora Night Org on Aurora PG). Re-seed of D9 tenants alone does not
-- touch those assignments. Scope is the demo email + Owner/Manager, not a
-- one-off tenant id. CS/Scanner/Supervisor grants are left unchanged.
-- Align event_assignments with packages/backend/src/role-map.ts.

DO $$
DECLARE
  owner_event_perms text[] := ARRAY[
    'event.update',
    'event.config',
    'event.publish',
    'inventory.import',
    'redemption.approve',
    'report.read',
    'export.create',
    'export.download',
    'cs.lookup',
    'cs.resend',
    'gate.confirm',
    'gate.undo',
    'ticket.revoke'
  ];
  manager_event_perms text[] := ARRAY[
    'event.update',
    'event.config',
    'event.publish',
    'inventory.import',
    'redemption.approve',
    'report.read',
    'export.create',
    'export.download'
  ];
BEGIN
  UPDATE event_assignments ea
  SET
    permissions = CASE m.role
      WHEN 'Owner' THEN owner_event_perms
      WHEN 'Manager' THEN manager_event_perms
      ELSE ea.permissions
    END,
    updated_at = clock_timestamp()
  FROM memberships m
  JOIN users u ON u.id = m.user_id
  WHERE ea.membership_id = m.id
    AND ea.tenant_id = m.tenant_id
    AND ea.revoked_at IS NULL
    AND m.revoked_at IS NULL
    AND m.role IN ('Owner', 'Manager')
    AND lower(u.email) = 'staff@example.com'
    AND (
      (m.role = 'Owner' AND ea.permissions IS DISTINCT FROM owner_event_perms)
      OR (m.role = 'Manager' AND ea.permissions IS DISTINCT FROM manager_event_perms)
    );

  INSERT INTO event_assignments (
    id,
    tenant_id,
    event_id,
    membership_id,
    permissions,
    activated_at,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid(),
    e.tenant_id,
    e.id,
    m.id,
    CASE m.role
      WHEN 'Owner' THEN owner_event_perms
      ELSE manager_event_perms
    END,
    clock_timestamp(),
    clock_timestamp(),
    clock_timestamp()
  FROM memberships m
  JOIN users u ON u.id = m.user_id
  JOIN events e ON e.tenant_id = m.tenant_id
  WHERE m.revoked_at IS NULL
    AND m.role IN ('Owner', 'Manager')
    AND lower(u.email) = 'staff@example.com'
    AND NOT EXISTS (
      SELECT 1
      FROM event_assignments ea
      WHERE ea.tenant_id = e.tenant_id
        AND ea.event_id = e.id
        AND ea.membership_id = m.id
        AND ea.revoked_at IS NULL
    );
END $$;
