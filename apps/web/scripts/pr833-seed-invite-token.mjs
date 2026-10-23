#!/usr/bin/env node
/**
 * Fixture invites for PR833 evidence — createMembershipInvite (staff actor), no SQL bypass.
 * Usage:
 *   node pr833-seed-invite-token.mjs pending <out-file>
 *   node pr833-seed-invite-token.mjs used <out-file>
 */
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const mode = process.argv[2];
const outFile = process.argv[3];
if (!mode || !outFile || !['pending', 'used'].includes(mode)) {
  console.error('usage: node pr833-seed-invite-token.mjs pending|used <out-file>');
  process.exit(1);
}

const require = createRequire(import.meta.url);
const backendDist = resolve(ROOT, 'packages/backend/dist');
const {
  createMembershipInvite,
  acceptMembershipInvite,
  readPlatformSecurityConfig,
  createDatabase,
} = require(backendDist);

const statePath = resolve(ROOT, '.fe-uat-stack/env.sh');
const dbUrl =
  process.env.FE_UAT_ADMIN_DATABASE_URL ||
  process.env.DATABASE_URL ||
  readFileSync(statePath, 'utf8')
    .match(/FE_UAT_ADMIN_DATABASE_URL='([^']+)'/)?.[1];

if (!dbUrl) {
  console.error('pr833-seed-invite-token: missing admin DATABASE_URL');
  process.exit(1);
}

const TENANT_ID =
  mode === 'used'
    ? 'd9d9f001-0001-4000-8000-000000000001'
    : 'd9d9f001-0001-4000-8000-000000000002';
const ATTENDEE_EMAIL = process.env.WEB_UAT_USER ?? 'attendee@example.com';

const db = createDatabase(dbUrl);
const security = readPlatformSecurityConfig(process.env);

try {
  const staffRows = await db.$queryRaw`SELECT id FROM users WHERE email = 'staff@example.com' LIMIT 1`;
  const staffUserId = staffRows[0]?.id;
  if (!staffUserId) {
    console.error('pr833-seed-invite-token: staff user missing');
    process.exit(1);
  }
  const inv = await createMembershipInvite(db, security, {
    tenantId: TENANT_ID,
    actorUserId: staffUserId,
    email: ATTENDEE_EMAIL,
    role: 'Manager',
    clientKey: `pr833-${mode}-${randomBytes(4).toString('hex')}`,
  });

  if (mode === 'used') {
    const attendeeRows =
      await db.$queryRaw`SELECT id FROM users WHERE email = ${ATTENDEE_EMAIL} LIMIT 1`;
    const attendeeUserId = attendeeRows[0]?.id;
    if (!attendeeUserId) {
      console.error('pr833-seed-invite-token: attendee user missing');
      process.exit(1);
    }
    await acceptMembershipInvite(db, {
      userId: attendeeUserId,
      email: ATTENDEE_EMAIL,
      emailVerified: true,
      token: inv.rawToken,
    });
  }

  writeFileSync(outFile, `${inv.rawToken}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ mode, tenantId: TENANT_ID, inviteId: inv.inviteId }));
} finally {
  await db.$disconnect();
}
