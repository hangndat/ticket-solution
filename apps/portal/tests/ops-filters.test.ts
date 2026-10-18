import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  alertToneForKind,
  assertUnknownNotSuccess,
  filterToolbarTabOrder,
  PORTAL_A11Y_SAMPLE,
} from '../src/ops/a11y-contracts';
import {
  exportAlertType,
  exportHistoryLabel,
  exportsListPath,
  interpretExportHistory,
} from '../src/ops/export-job';
import {
  notificationsListUpstreamPath,
} from '../src/ops/notifications';
import { pendingListPath } from '../src/ops/pending';

const scope = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  eventId: '22222222-2222-4222-8222-222222222222',
};

const here = dirname(fileURLToPath(import.meta.url));

describe('G-R1 / G-N1 / G-E1 filter path builders', () => {
  it('G-R1 pending: sourceId / ticketTypeId / q optional', () => {
    const legacy = pendingListPath(scope, { status: 'PENDING_REVIEW', limit: 20 });
    assert.match(legacy, /status=PENDING_REVIEW/);
    assert.doesNotMatch(legacy, /sourceId=/);

    const filtered = pendingListPath(scope, {
      status: 'PENDING_REVIEW',
      sourceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ticketTypeId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      q: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      limit: 10,
    });
    assert.match(filtered, /sourceId=aaaaaaaa/);
    assert.match(filtered, /ticketTypeId=bbbbbbbb/);
    assert.match(filtered, /q=cccccccc/);
  });

  it('G-N1 notifications: state / channel optional', () => {
    const legacy = notificationsListUpstreamPath(scope);
    assert.equal(
      legacy,
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/notifications`,
    );

    const filtered = notificationsListUpstreamPath(scope, {
      state: 'FAILED',
      channel: 'email',
      limit: 50,
    });
    assert.match(filtered, /state=FAILED/);
    assert.match(filtered, /channel=email/);
    assert.match(filtered, /limit=50/);
  });

  it('G-E1 exports history: status optional; interpret fail-closed', () => {
    const path = exportsListPath(scope, { status: 'READY', limit: 20 });
    assert.match(path, /status=READY/);
    assert.match(path, /limit=20/);

    const ok = interpretExportHistory(
      200,
      {
        items: [
          {
            exportId: '44444444-4444-4444-8444-444444444444',
            status: 'READY',
            createdAt: '2026-01-01T00:00:00.000Z',
            rowCount: 2,
          },
        ],
        nextCursor: null,
      },
      false,
    );
    assert.equal(ok.kind, 'list');
    if (ok.kind === 'list') assert.equal(ok.items[0]?.status, 'READY');

    const leak = interpretExportHistory(
      200,
      {
        items: [
          {
            exportId: '44444444-4444-4444-8444-444444444444',
            status: 'READY',
            downloadUrl: 'https://evil.example/x',
          },
        ],
        nextCursor: null,
      },
      false,
    );
    assert.equal(leak.kind, 'unknown');
    assert.equal(exportAlertType(leak), 'warning');
    assert.match(exportHistoryLabel(leak), /chưa biết/i);
  });
});

describe('unknown ≠ success', () => {
  it('exportAlertType maps unknown/rejected away from success', () => {
    assert.equal(
      exportAlertType({ kind: 'unknown', message: 'x' }),
      'warning',
    );
    assert.equal(
      exportAlertType({ kind: 'rejected', code: 'X', message: 'y' }),
      'error',
    );
    assert.equal(
      exportAlertType({
        kind: 'created',
        job: {
          exportId: 'e',
          status: 'PENDING',
          rowCount: null,
          expiresAt: null,
          error: null,
          replayed: false,
        },
      }),
      'success',
    );
  });

  it('a11y contract helpers', () => {
    assert.equal(alertToneForKind('unknown'), 'warning');
    assert.equal(alertToneForKind('rejected'), 'error');
    assert.equal(alertToneForKind('list'), 'success');
    assert.equal(assertUnknownNotSuccess('unknown'), false);
    assert.equal(assertUnknownNotSuccess('list'), true);
    assert.deepEqual(filterToolbarTabOrder().slice(0, 2), [
      'filter-field-1',
      'filter-field-2',
    ]);
    assert.equal(PORTAL_A11Y_SAMPLE.minHitTargetPx, 44);
  });
});

describe('keyboard / axe sample fixtures', () => {
  it('filter toolbar fixture has search landmark + labelled controls', () => {
    const html = readFileSync(
      join(here, 'fixtures/filter-toolbar-a11y.html'),
      'utf8',
    );
    assert.match(html, /role="search"/);
    assert.match(html, /aria-label="Áp dụng bộ lọc"/);
    assert.match(html, /portal-skip-link/);
    assert.match(html, /#portal-main/);
  });

  it('axe-core is available for future headless UAT (sample import)', async () => {
    const axe = await import('axe-core');
    assert.ok(axe.source || axe.default?.source || typeof axe === 'object');
  });
});
