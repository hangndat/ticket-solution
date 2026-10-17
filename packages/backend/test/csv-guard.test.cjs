const { test } = require('node:test');
const assert = require('node:assert/strict');
const { escapeCsvCell, toCsvRow, providerStatusFromDbState, maskEmail } =
  require('../dist');

test('csv guard prefixes formula-like and whitespace-led cells', () => {
  assert.equal(escapeCsvCell('=1+1'), "'=1+1");
  assert.equal(escapeCsvCell('+cmd'), "'+cmd");
  assert.equal(escapeCsvCell('-2'), "'-2");
  assert.equal(escapeCsvCell('@x'), "'@x");
  assert.equal(escapeCsvCell('\t=1'), "'\t=1");
  assert.equal(escapeCsvCell('\r=1'), `"'\r=1"`); // CR forces CSV quoting
  assert.equal(escapeCsvCell('  =1'), "'  =1");
  assert.equal(escapeCsvCell('safe'), 'safe');
  assert.equal(escapeCsvCell('a,b'), '"a,b"');
  assert.equal(toCsvRow(['=1', 'ok']).startsWith("'=1"), true);
});

test('providerStatus maps SENT to ACCEPTED never delivered', () => {
  assert.equal(providerStatusFromDbState('SENT'), 'ACCEPTED');
  assert.equal(providerStatusFromDbState('PENDING'), 'PENDING');
  assert.equal(providerStatusFromDbState('FAILED'), 'FAILED');
  assert.equal(maskEmail('attendee@example.com'), 'a***@example.com');
  assert.equal(maskEmail(null), null);
});
