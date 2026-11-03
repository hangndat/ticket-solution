import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const { Client } = createRequire(
  resolve(process.cwd(), 'packages/backend/package.json'),
)('pg');

export async function readOpenDeletions(userId: string | undefined) {
  if (!process.env.DATABASE_URL || !process.env.E2E_RUN_DIR || !userId)
    throw new Error(
      'BLOCKED: account deletion requires run-local database and actor',
    );
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SELECT set_config('app.actor_id', $1, true)", [userId]);
    const result = await client.query(
      "SELECT id, state FROM account_deletion_requests WHERE user_id = $1::uuid AND state IN ('REQUESTED', 'UNDER_REVIEW', 'AWAITING_POLICY') ORDER BY id",
      [userId],
    );
    await client.query('COMMIT');
    return result.rows as { id: string; state: string }[];
  } finally {
    await client.end();
  }
}
