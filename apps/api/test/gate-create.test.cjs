const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../dist/app');

const eventId = '00000000-0000-4000-8000-000000000001';
const tenantId = '00000000-0000-4000-8000-000000000002';
const url = `/v1/gate/events/${eventId}/gates`;

async function postCreate(app, sortOrder) {
  const payload = { tenantId, name: 'Test gate' };
  if (sortOrder !== undefined) payload.sortOrder = sortOrder;
  return app.inject({
    method: 'POST',
    url,
    payload,
  });
}

test('POST create gate rejects out-of-range sortOrder with 422', async () => {
  const app = await createApp(false);
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    for (const sortOrder of [-1, 10000]) {
      const res = await postCreate(app, sortOrder);
      assert.equal(res.statusCode, 422, `sortOrder ${sortOrder}`);
      assert.equal(res.json().code, 'SCOPE_REQUIRED');
      assert.match(res.json().message, /between 0 and 9999/);
    }

    const nonInt = await postCreate(app, 1.5);
    assert.equal(nonInt.statusCode, 422);
    assert.equal(nonInt.json().code, 'SCOPE_REQUIRED');
    assert.match(nonInt.json().message, /integer/);
  } finally {
    await app.close();
  }
});
