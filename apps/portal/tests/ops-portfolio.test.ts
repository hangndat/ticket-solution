import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PORTFOLIO_PARTIAL_ALERT,
  interpretPortfolio,
  portfolioUpstreamPath,
} from '../src/ops/portfolio';

const eventA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const eventB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const asOf = '2026-10-19T02:00:00.000Z';

function shownItem(overrides: Record<string, unknown> = {}) {
  return {
    eventId: eventA,
    title: 'Demo Night',
    checkInSuccessCount: 12,
    pendingApprovalCount: 3,
    emailNeedsCsCount: 1,
    quotaRemaining: 40,
    quotaCapacityState: 'FINITE',
    rejectByReason: { ALREADY_CHECKED_IN: 2 },
    ...overrides,
  };
}

describe('interpretPortfolio', () => {
  it('shows O12 counts for HTTP 200 complete envelope', () => {
    const view = interpretPortfolio(
      200,
      {
        asOf,
        items: [shownItem(), shownItem({ eventId: eventB, title: 'B' })],
        nextCursor: null,
        limit: 20,
      },
      false,
    );
    assert.equal(view.kind, 'shown');
    if (view.kind !== 'shown') return;
    assert.equal(view.asOf, asOf);
    assert.equal(view.items.length, 2);
    assert.equal(view.hasPartial, false);
    assert.equal(view.items[0]!.kind, 'shown');
    if (view.items[0]!.kind === 'shown') {
      assert.equal(view.items[0].checkInSuccessCount, 12);
      assert.equal(view.items[0].pendingApprovalCount, 3);
    }
  });

  it('marks bad rows unknown without inventing 0 — page hasPartial', () => {
    const view = interpretPortfolio(
      200,
      {
        asOf,
        items: [
          shownItem(),
          { eventId: eventB, title: 'Broken' }, // missing O12 fields
        ],
        nextCursor: null,
        limit: 20,
      },
      false,
    );
    assert.equal(view.kind, 'shown');
    if (view.kind !== 'shown') return;
    assert.equal(view.hasPartial, true);
    assert.equal(view.items[0]!.kind, 'shown');
    assert.equal(view.items[1]!.kind, 'unknown');
    if (view.items[1]!.kind === 'unknown') {
      assert.equal(view.items[1].eventId, eventB);
    }
    assert.match(PORTFOLIO_PARTIAL_ALERT, /không dùng số 0 giả/i);
  });

  it('reject UNLIMITED with fake quotaRemaining 0', () => {
    const view = interpretPortfolio(
      200,
      {
        asOf,
        items: [
          shownItem({
            quotaCapacityState: 'UNLIMITED',
            quotaRemaining: 0,
          }),
        ],
        nextCursor: null,
        limit: 20,
      },
      false,
    );
    assert.equal(view.kind, 'shown');
    if (view.kind !== 'shown') return;
    assert.equal(view.items[0]!.kind, 'unknown');
  });

  it('network / 5xx are unknown — no counts', () => {
    assert.equal(interpretPortfolio(0, null, true).kind, 'unknown');
    assert.equal(interpretPortfolio(500, { asOf }, false).kind, 'unknown');
  });

  it('403 with code is rejected', () => {
    const view = interpretPortfolio(
      403,
      { code: 'FORBIDDEN', message: 'nope' },
      false,
    );
    assert.equal(view.kind, 'rejected');
    if (view.kind !== 'rejected') return;
    assert.equal(view.code, 'FORBIDDEN');
  });

  it('empty items is shown (UI empty), not unknown', () => {
    const view = interpretPortfolio(
      200,
      { asOf, items: [], nextCursor: null, limit: 20 },
      false,
    );
    assert.equal(view.kind, 'shown');
    if (view.kind !== 'shown') return;
    assert.equal(view.items.length, 0);
  });
});

describe('portfolioUpstreamPath', () => {
  it('uses reports/portfolio — not report-summary', () => {
    const path = portfolioUpstreamPath(
      '11111111-1111-4111-8111-111111111111',
    );
    assert.match(path, /\/reports\/portfolio$/);
    assert.doesNotMatch(path, /report-summary/);
  });
});
