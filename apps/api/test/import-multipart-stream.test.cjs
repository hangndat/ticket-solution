const assert = require('node:assert/strict');
const test = require('node:test');
const { InventoryController } = require('../dist/inventory');

const tenant = '11111111-1111-4111-8111-111111111111';
const event = '22222222-2222-4222-8222-222222222222';

test('multipart stream failure never reaches the quarantine service', async () => {
  let calls = 0;
  const controller = new InventoryController({
    uploadFile: async () => {
      calls++;
    },
  });
  async function* broken() {
    yield Buffer.from('code\nA');
    throw new Error('connection lost');
  }
  async function* parts() {
    yield { type: 'field', fieldname: 'kind', value: 'CODES' };
    yield {
      type: 'file',
      fieldname: 'file',
      filename: 'x.csv',
      mimetype: 'text/csv',
      file: broken(),
    };
  }
  await assert.rejects(
    controller.uploadFile('Bearer test', tenant, event, { parts }),
    (error) => {
      assert.equal(error.getStatus(), 422);
      assert.equal(error.getResponse().code, 'IMPORT_FILE_INVALID');
      return true;
    },
  );
  assert.equal(calls, 0);
});
