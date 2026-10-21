#!/usr/bin/env node
/**
 * Epic #686 prod-like pilot seed. Env: DATABASE_URL, CODE_HMAC_PEPPER,
 * PROD_SEED_CONFIRM=1 (mutate) or PROD_SEED_DRY_RUN=1 (transaction rollback).
 * Never logs secrets.
 */
'use strict';

const {
  createDatabase,
  readCodeHmacEnvironment,
  seedProdDataset,
  PROD_SEED,
  assertProdSeedDatabaseHostAllowed,
  assertProdSeedMutateAllowed,
} = require('../dist');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url?.trim()) {
    console.error('DATABASE_URL required');
    process.exit(2);
  }
  try {
    assertProdSeedDatabaseHostAllowed(url);
    assertProdSeedMutateAllowed(process.env);
  } catch (e) {
    console.error(e && e.message ? e.message : String(e));
    process.exit(2);
  }

  const dryRun =
    process.env.PROD_SEED_DRY_RUN === '1' ||
    process.env.PROD_SEED_DRY_RUN === 'true';

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

  const forceRepublishMarketing =
    process.env.PROD_SEED_FORCE_MARKETING === '1' ||
    process.env.PROD_SEED_FORCE_MARKETING === 'true';

  const createMissingStaffUsers =
    process.env.PROD_SEED_CREATE_STAFF_USERS === '1' ||
    process.env.PROD_SEED_CREATE_STAFF_USERS === 'true';

  const db = createDatabase(url, 2);
  try {
    const report = await seedProdDataset(db, hmac, {
      oidcIssuer: issuer,
      forceRepublishMarketing,
      dryRun,
      createMissingStaffUsers,
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          namespace: PROD_SEED.namespace,
          dryRun,
          issuer,
          forceRepublishMarketing,
          createMissingStaffUsers,
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
