const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateDatabaseUrl, withTenant } = require('../dist');
test('database URL and tenant ID validation do not echo credentials', async () => {
  assert.throws(() => validateDatabaseUrl('secret'), {
    message: 'DATABASE_URL must be a PostgreSQL URL with host and database',
  });
  assert.equal(
    validateDatabaseUrl('postgresql://localhost/example'),
    'postgresql://localhost/example',
  );
  await assert.rejects(
    withTenant({}, 'malicious', async () => {}),
    /Invalid tenant/,
  );
});
