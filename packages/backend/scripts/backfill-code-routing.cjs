#!/usr/bin/env node
'use strict';

/**
 * Backfill code_routing_* from existing redemption_codes rows.
 * Usage: DATABASE_URL=… node packages/backend/scripts/backfill-code-routing.cjs
 */

const { createDatabase, backfillCodeRoutingFromRedemptionCodes } = require('../dist/index.js');

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const db = createDatabase(url);
  try {
    const report = await db.$transaction((tx) =>
      backfillCodeRoutingFromRedemptionCodes(tx),
    );
    console.log(JSON.stringify(report));
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
