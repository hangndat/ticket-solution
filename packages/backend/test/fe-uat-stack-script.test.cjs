'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

test('fe-uat-stack.sh documents bootstrap + Keycloak subject seed', () => {
  const sh = readFileSync(
    path.join(__dirname, '../../../scripts/fe-uat-stack.sh'),
    'utf8',
  );
  assert.match(sh, /d9-demo-bootstrap-db\.mjs/);
  assert.match(sh, /fe-uat-keycloak-tokens\.mjs/);
  assert.match(sh, /D9_DEMO_STAFF_SUBJECT/);
  assert.match(sh, /SINGLE_CODE_RESOLVE_GLOBAL/);
  assert.match(sh, /fe-uat-stack-sanity\.mjs/);
});
