'use strict';

const { readdirSync, statSync } = require('node:fs');
const path = require('node:path');

// Database tests that apply migrations also issue gate credentials. Keep the
// required test-only pepper available without supplying or weakening runtime config.
require('./gate-test-credentials.cjs');

const MIGRATIONS_DIR = path.join(__dirname, '../prisma/migrations');

/** Every migration.sql under prisma/migrations, sorted by directory name. */
function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) =>
      statSync(path.join(MIGRATIONS_DIR, name)).isDirectory(),
    )
    .sort()
    .map((name) => path.join(MIGRATIONS_DIR, name, 'migration.sql'));
}

module.exports = { migrationFiles, MIGRATIONS_DIR };
