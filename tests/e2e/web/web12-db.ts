import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const requireBackend = createRequire(
  resolve(process.cwd(), 'packages/backend/package.json'),
);
const { Client } = requireBackend('pg');

/**
 * Lead/users/tenants/memberships are global tables (no RLS tenant scope) —
 * query via the admin role rather than withTenant.
 */
export async function readTenantProvisionSnapshot(email: string) {
  if (!process.env.DATABASE_URL || !process.env.E2E_RUN_DIR)
    throw new Error(
      'BLOCKED: WEB-12 negative check requires isolated E2E PostgreSQL',
    );
  const adminUrl = new URL(process.env.DATABASE_URL);
  adminUrl.username = 'postgres';
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const tenants = await client.query(
      "SELECT count(*)::int AS n FROM tenants WHERE status='ACTIVE'",
    );
    const users = await client.query(
      'SELECT count(*)::int AS n FROM users WHERE email=$1',
      [email],
    );
    const memberships = await client.query(
      `SELECT count(*)::int AS n FROM memberships m
       JOIN users u ON u.id = m.user_id
       WHERE u.email=$1 AND m.role='Owner'`,
      [email],
    );
    await client.query('COMMIT');
    return {
      activeTenants: tenants.rows[0].n as number,
      usersWithEmail: users.rows[0].n as number,
      ownerMembershipsForEmail: memberships.rows[0].n as number,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}
