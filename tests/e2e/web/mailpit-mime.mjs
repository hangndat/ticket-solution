/** Parse Mailpit raw MIME — ticket-qr PNG must live in one part (WEB08-DOD-02). */

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** 1×1 PNG for unit fixtures */
export const FIXTURE_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAD0lEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractMimeBoundary(rawMime) {
  const match = rawMime.match(
    /Content-Type:\s*multipart\/[^\r\n]+(?:[\r\n]+(?![\r\n])[^\r\n]+)*/i,
  );
  if (!match) return null;
  const block = match[0];
  const quoted = block.match(/boundary="([^"]+)"/i);
  if (quoted) return quoted[1];
  const unquoted = block.match(/boundary=([^;\r\n\s]+)/i);
  return unquoted ? unquoted[1].trim() : null;
}

export function splitMimeParts(rawMime, boundary) {
  const pattern = new RegExp(
    `\\r?\\n--${escapeRegExp(boundary)}(?:--)?\\r?\\n`,
    'g',
  );
  const segments = rawMime.split(pattern);
  return segments
    .slice(1)
    .map((part) => part.replace(/\r?\n--\s*$/u, '').trimEnd());
}

function partHeaders(part) {
  const sep = part.search(/\r?\n\r?\n/);
  return sep === -1 ? part : part.slice(0, sep);
}

export function partBody(part) {
  const sep = part.search(/\r?\n\r?\n/);
  if (sep === -1) return '';
  return part
    .slice(sep)
    .replace(/^\r?\n\r?\n/, '')
    .replace(/\r?\n--[\s\S]*$/, '')
    .trim();
}

/** Flatten nested multipart/* so image/png parts are reachable. */
export function collectMimeParts(rawMime) {
  const collected = [];
  function walk(segment) {
    const boundary = extractMimeBoundary(segment);
    if (!boundary) {
      collected.push(segment);
      return;
    }
    for (const part of splitMimeParts(segment, boundary)) {
      if (/Content-Type:\s*multipart\//i.test(partHeaders(part))) {
        walk(part);
      } else {
        collected.push(part);
      }
    }
  }
  walk(rawMime);
  return collected;
}

export function decodeTicketQrPngFromRawMime(rawMime) {
  const parts = collectMimeParts(rawMime);
  const qrPart = parts.find((part) => {
    const headers = partHeaders(part);
    return (
      /Content-ID:\s*<ticket-qr@vemoki>/i.test(headers) &&
      /Content-Type:\s*image\/png/i.test(headers) &&
      /Content-Transfer-Encoding:\s*base64/i.test(headers)
    );
  });
  if (!qrPart) {
    throw new Error(
      'no MIME part combines Content-ID ticket-qr@vemoki, image/png, and base64 encoding',
    );
  }
  const b64 = partBody(qrPart).replace(/\s/g, '');
  if (!b64) {
    throw new Error('ticket-qr PNG part has empty body');
  }
  const png = Buffer.from(b64, 'base64');
  if (png.length < 8 || !png.subarray(0, 8).equals(PNG_SIG)) {
    throw new Error('ticket-qr part is not a valid PNG');
  }
  return png;
}
