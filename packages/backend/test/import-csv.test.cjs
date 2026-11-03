const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  assertUtf8Csv,
  normalizeMapping,
  parsePayload,
} = require('../dist/import-csv');
const { IMPORT_ERROR_CODES } = require('../dist/import-error');

test('import CSV rejects malformed bytes before preview or commit', () => {
  assert.throws(() => assertUtf8Csv(Buffer.from([0xff, 0xfe, 0x00])), {
    code: IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
  });
  assert.throws(
    () =>
      assertUtf8Csv(Buffer.from([0x65, 0x6d, 0x61, 0x69, 0x6c, 0x0a, 0xff])),
    { code: IMPORT_ERROR_CODES.IMPORT_FILE_INVALID },
  );
});

test('guest preview canonicalizes email and reports duplicate without exposing it in CSV', () => {
  const mapping = normalizeMapping('GUESTS');
  const parsed = parsePayload(
    'GUESTS',
    mapping,
    'email\nAlice@Example.com\nalice@example.com\n',
    10,
  );
  assert.deepEqual(
    parsed.valid.map(({ line, value }) => ({ line, value })),
    [{ line: 2, value: 'alice@example.com' }],
  );
  assert.equal(parsed.errors[0].code, 'DUPLICATE_IN_FILE');
  assert.equal(parsed.errors[0].fieldId, 'row:3:email');
  assert.doesNotMatch(parsed.errorCsv, /alice@example\.com/i);
});

test('code preview parses quoted delimiters, dedupes case-insensitively and masks errors', () => {
  const parsed = parsePayload(
    'CODES',
    normalizeMapping('CODES'),
    'code\n"ab,cd"\n"AB,CD"\n',
    10,
  );
  assert.equal(parsed.valid[0].value, 'ab,cd');
  assert.equal(parsed.errors[0].code, 'DUPLICATE_IN_FILE');
  assert.doesNotMatch(parsed.errorCsv, /AB,CD/);
  assert.match(parsed.errorCsv, /A\*\*\*/);
});

test('row limit and cross-kind mapping fail before writing an import job', () => {
  assert.throws(
    () => parsePayload('CODES', normalizeMapping('CODES'), 'code\nA\nB\n', 1),
    { code: IMPORT_ERROR_CODES.IMPORT_ROW_LIMIT },
  );
  assert.throws(() => normalizeMapping('GUESTS', { code: 'code' }), {
    code: IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
  });
});
