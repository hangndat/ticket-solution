#!/usr/bin/env node
/**
 * Offline one-time platform operator bootstrap.
 * Reads JSON from stdin: { "userId": "<uuid>" } of an already MFA-verified identity mapping.
 * Never pass secrets/tokens on argv. Does not log the payload.
 */
'use strict';
const { createDatabase, bootstrapPlatformOperator } = require('../dist');

async function main() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    console.error('stdin required: {"userId":"<uuid>"}');
    process.exit(2);
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    console.error('invalid json');
    process.exit(2);
  }
  const userId = typeof body.userId === 'string' ? body.userId : '';
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    console.error('userId uuid required');
    process.exit(2);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL required');
    process.exit(2);
  }
  const db = createDatabase(url, 2);
  try {
    await bootstrapPlatformOperator(db, { userId });
    console.log('bootstrap_ok');
  } catch (e) {
    console.error(e && e.code ? e.code : 'bootstrap_failed');
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
