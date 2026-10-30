import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIXTURE_PNG_B64,
  decodeTicketQrPngFromRawMime,
} from '../web/mailpit-mime.mjs';

function validTicketQrMime() {
  return [
    'Content-Type: multipart/mixed; boundary="bound"',
    '',
    '--bound',
    'Content-Type: text/plain',
    '',
    'Ticket link',
    '--bound',
    'Content-Type: image/png',
    'Content-Transfer-Encoding: base64',
    'Content-ID: <ticket-qr@vemoki>',
    '',
    FIXTURE_PNG_B64,
    '--bound--',
    '',
  ].join('\r\n');
}

test('decodeTicketQrPngFromRawMime accepts PNG bytes on the ticket-qr part', () => {
  const png = decodeTicketQrPngFromRawMime(validTicketQrMime());
  assert.ok(png.length > 8);
  assert.equal(png[0], 0x89);
});

test('decodeTicketQrPngFromRawMime rejects CID on one part and PNG on another', () => {
  const mismatched = [
    'Content-Type: multipart/mixed; boundary="bound"',
    '',
    '--bound',
    'Content-Type: text/plain',
    'Content-ID: <ticket-qr@vemoki>',
    '',
    'wrong part carries CID only',
    '--bound',
    'Content-Type: image/png',
    'Content-Transfer-Encoding: base64',
    '',
    FIXTURE_PNG_B64,
    '--bound--',
    '',
  ].join('\r\n');
  assert.throws(
    () => decodeTicketQrPngFromRawMime(mismatched),
    /no MIME part combines/,
  );
});
