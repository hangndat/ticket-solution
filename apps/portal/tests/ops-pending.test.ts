import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  interpretPendingList,
  pendingListLabel,
  pendingListPath,
} from '../src/ops/pending';

const scope = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  eventId: '22222222-2222-4222-8222-222222222222',
};

describe('portal pending BFF helpers (G-R2)', () => {
  it('builds list path with status filter', () => {
    assert.equal(
      pendingListPath(scope, { status: 'PENDING_REVIEW', limit: 20 }),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/redemptions?limit=20&status=PENDING_REVIEW`,
    );
  });

  it('interprets list and fails closed on email PII', () => {
    const ok = interpretPendingList(
      200,
      {
        items: [
          {
            requestId: '33333333-3333-4333-8333-333333333333',
            status: 'PENDING_REVIEW',
            sourceId: null,
            ticketTypeId: null,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        nextCursor: null,
      },
      false,
    );
    assert.equal(ok.kind, 'list');
    if (ok.kind === 'list') assert.equal(ok.items.length, 1);

    const leak = interpretPendingList(
      200,
      {
        items: [
          {
            requestId: '33333333-3333-4333-8333-333333333333',
            status: 'PENDING_REVIEW',
            email: 'leak@example.com',
          },
        ],
        nextCursor: null,
      },
      false,
    );
    assert.equal(leak.kind, 'unknown');
    assert.match(pendingListLabel(leak), /chưa biết/i);
  });

  it('unknown on network / 500', () => {
    assert.equal(interpretPendingList(0, null, true).kind, 'unknown');
    assert.equal(interpretPendingList(503, null, false).kind, 'unknown');
  });
});
