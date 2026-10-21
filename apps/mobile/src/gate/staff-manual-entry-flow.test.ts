import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildManualEntryPreviewLine,
  checkManualEntryCode,
} from './staff-manual-entry-flow.ts';

const ticketId = '11111111-1111-4111-8111-111111111111';
const tenantId = '22222222-2222-4222-8222-222222222222';
const eventId = '33333333-3333-4333-8333-333333333333';

describe('staff-manual-entry-flow', () => {
  it('rejects empty input', () => {
    const result = checkManualEntryCode('  ', {
      tenantId,
      eventId,
      name: 'MFest',
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /Nhập mã/);
    }
  });

  it('parses bare UUID with gate scope fallback', () => {
    const result = checkManualEntryCode(ticketId, {
      tenantId,
      eventId,
      name: 'MFest',
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.parsed.ticketId, ticketId);
      assert.match(result.previewLine, /MFest/);
      assert.match(result.previewLine, new RegExp(ticketId));
    }
  });

  it('rejects unreadable codes', () => {
    const result = checkManualEntryCode('not-a-uuid', {
      tenantId,
      eventId,
      name: 'MFest',
    });
    assert.equal(result.ok, false);
  });

  it('builds preview with fallback event label', () => {
    const line = buildManualEntryPreviewLine(null, {
      ticketId,
      tenantId,
      eventId,
    });
    assert.match(line, /Sự kiện đang chọn/);
  });
});
