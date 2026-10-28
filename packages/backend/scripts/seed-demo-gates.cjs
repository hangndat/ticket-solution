#!/usr/bin/env node
/**
 * O31: idempotent demo gates for Epic #686 fixture events (counts 1 / 2 / 3).
 * VPS (runbook): docker compose exec api with GATE_SEED_CONFIRM=1.
 * Does not print secrets. Re-run skips existing names (409-equivalent).
 *
 *   GATE_SEED_CONFIRM=1 node packages/backend/scripts/seed-demo-gates.cjs
 */
'use strict';

const {
  createDatabase,
  seedProdDemoGates,
  PROD_SEED,
} = require('../dist');

async function main() {
  const confirm = process.env.GATE_SEED_CONFIRM?.trim();
  if (confirm !== '1' && confirm !== 'yes') {
    console.error('Set GATE_SEED_CONFIRM=1 to seed demo gates');
    process.exit(2);
  }
  const url = process.env.DATABASE_URL;
  if (!url?.trim()) {
    console.error('DATABASE_URL required');
    process.exit(2);
  }

  const db = createDatabase(url, 2);
  try {
    const report = await seedProdDemoGates(db);
    console.log(
      JSON.stringify(
        { ok: true, namespace: PROD_SEED.namespace, ...report },
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
