#!/usr/bin/env node
/**
 * Idempotent D9 multi-tenant demo seed (fixture).
 * Env: DATABASE_URL, CODE_HMAC_PEPPER, optional OIDC_ISSUER / CODE_HMAC_VERSION.
 * Never logs secrets. Safe to re-run.
 */
'use strict';

const {
  createDatabase,
  readCodeHmacEnvironment,
  seedD9DemoDataset,
  D9_DEMO,
} = require('../dist');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url?.trim()) {
    console.error('DATABASE_URL required');
    process.exit(2);
  }
  const issuer =
    process.env.OIDC_ISSUER?.trim() ||
    'http://127.0.0.1:8080/realms/ticket';
  let hmac;
  try {
    hmac = readCodeHmacEnvironment(process.env);
  } catch (e) {
    console.error(e && e.message ? e.message : 'CODE_HMAC_PEPPER required');
    process.exit(2);
  }

  const db = createDatabase(url, 2);
  try {
    const report = await seedD9DemoDataset(db, hmac, {
      oidcIssuer: issuer,
      staffSubject: process.env.D9_DEMO_STAFF_SUBJECT,
      attendeeSubject: process.env.D9_DEMO_ATTENDEE_SUBJECT,
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          fixture: true,
          marker: D9_DEMO.marker,
          issuer,
          ...report,
        },
        null,
        2,
      ),
    );
  } catch (e) {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
