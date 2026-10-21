'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

test('d9 demo bootstrap grants platform runtime role to API login', () => {
  const bootstrapPath = path.join(
    __dirname,
    '../../../scripts/lib/d9-demo-bootstrap-db.mjs',
  );
  const src = readFileSync(bootstrapPath, 'utf8');
  assert.match(
    src,
    /GRANT ticket_runtime TO \$\{runtimeUser\}/,
    'runtime login must inherit ticket_runtime (tenant RLS pool)',
  );
  assert.match(
    src,
    /GRANT ticket_platform_runtime TO \$\{runtimeUser\}/,
    'runtime login must inherit ticket_platform_runtime for GET /v1/public/events',
  );
});
