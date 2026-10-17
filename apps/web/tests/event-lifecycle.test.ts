import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CREATE_EVENT_UNKNOWN,
  createEventUpstreamPath,
  interpretCreateEvent,
  interpretEventList,
} from '../src/admin/create-event';
import {
  buildCancelEventBody,
  buildCloneEventBody,
  buildPatchEventBody,
  EVENT_DETAIL_UNKNOWN,
  EVENT_IMPACT_UNKNOWN,
  eventArchiveUpstreamPath,
  eventCancelUpstreamPath,
  eventCloneUpstreamPath,
  eventDetailUpstreamPath,
  eventImpactPreviewUpstreamPath,
  interpretEventDetail,
  interpretEventImpactPreview,
  interpretEventMutation,
  parseEventDetail,
  patchMayAffectIssuedTickets,
} from '../src/admin/event-lifecycle';
import {
  parseArchiveBody,
  parseCancelBody,
  parseCloneBody,
  parseImpactBody,
  parsePatchBody,
} from '../src/admin/event-bff-body';
import {
  fixtureCancelEvent,
  fixtureCloneEvent,
  fixtureEventCommands,
  fixtureEventDetail,
  fixtureImpactPreview,
  fixturePatchEvent,
  legacyEventSummary,
} from './fixtures/event-ce';

const scope = {
  tenantId: fixtureEventDetail.tenantId,
  eventId: fixtureEventDetail.eventId,
};

describe('C-E paths and commands', () => {
  it('builds upstream paths matching EVENT_ENDPOINTS', () => {
    assert.equal(
      createEventUpstreamPath(scope.tenantId),
      `/v1/tenants/${scope.tenantId}/events`,
    );
    assert.equal(
      eventDetailUpstreamPath(scope),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}`,
    );
    assert.equal(
      eventCloneUpstreamPath(scope),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/clone`,
    );
    assert.equal(
      eventArchiveUpstreamPath(scope),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/archive`,
    );
    assert.equal(
      eventCancelUpstreamPath(scope),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/cancel`,
    );
    assert.equal(
      eventImpactPreviewUpstreamPath(scope),
      `/v1/tenants/${scope.tenantId}/events/${scope.eventId}/impact-preview`,
    );
  });

  it('uses frozen operation command literals', () => {
    assert.equal(fixtureEventCommands.create, 'event.create');
    assert.equal(fixtureEventCommands.update, 'event.update');
    assert.equal(fixtureEventCommands.clone, 'event.clone');
    assert.equal(fixtureEventCommands.archive, 'event.archive');
    assert.equal(fixtureEventCommands.cancel, 'event.cancel');
  });
});

describe('C-E EventDetail interpreters', () => {
  it('accepts contract fixture EventDetail', () => {
    const parsed = parseEventDetail(fixtureEventDetail);
    assert.ok(parsed);
    assert.equal(parsed?.revision, 3);
    assert.equal(parsed?.contentStatus, 'DRAFT');
    assert.equal(parsed?.businessStatus, 'ACTIVE');

    const detail = interpretEventDetail(200, fixtureEventDetail, false);
    assert.equal(detail.kind, 'detail');

    const created = interpretCreateEvent(201, fixtureEventDetail, false);
    assert.equal(created.kind, 'ok');
    if (created.kind === 'ok') {
      assert.equal(created.event.eventId, fixtureEventDetail.eventId);
    }

    const list = interpretEventList(
      200,
      { items: [fixtureEventDetail], nextCursor: null },
      false,
    );
    assert.equal(list.kind, 'list');
    if (list.kind === 'list') {
      assert.equal(list.items.length, 1);
      assert.equal(list.nextCursor, null);
    }
  });

  it('fail-closed: rejects legacy status summary and 5xx/network', () => {
    assert.equal(parseEventDetail(legacyEventSummary), null);
    assert.equal(
      interpretCreateEvent(200, legacyEventSummary, false).kind,
      'unknown',
    );
    const unknown = interpretCreateEvent(503, fixtureEventDetail, false);
    assert.equal(unknown.kind, 'unknown');
    if (unknown.kind === 'unknown') {
      assert.equal(unknown.message, CREATE_EVENT_UNKNOWN);
    }
    const net = interpretEventDetail(0, null, true);
    assert.equal(net.kind, 'unknown');
    if (net.kind === 'unknown') {
      assert.equal(net.message, EVENT_DETAIL_UNKNOWN);
    }
  });

  it('impact preview requires confirm fields; mutation returns EventDetail', () => {
    const preview = interpretEventImpactPreview(
      200,
      fixtureImpactPreview,
      false,
    );
    assert.equal(preview.kind, 'preview');
    if (preview.kind === 'preview') {
      assert.equal(preview.preview.requiresConfirm, true);
      assert.equal(preview.preview.affectedTicketCount, 12);
    }
    assert.equal(
      interpretEventImpactPreview(500, fixtureImpactPreview, false).kind,
      'unknown',
    );
    const bad = interpretEventImpactPreview(
      200,
      { revision: 3, affectedTicketCount: 1 },
      false,
    );
    assert.equal(bad.kind, 'unknown');
    if (bad.kind === 'unknown') {
      assert.equal(bad.message, EVENT_IMPACT_UNKNOWN);
    }

    const patched = {
      ...fixtureEventDetail,
      revision: 4,
      startsAt: fixturePatchEvent.startsAt!,
    };
    const mut = interpretEventMutation(200, patched, false);
    assert.equal(mut.kind, 'ok');
  });

  it('patchMayAffectIssuedTickets detects startsAt/venue changes', () => {
    assert.equal(
      patchMayAffectIssuedTickets(fixtureEventDetail, {
        startsAt: '2026-11-01T11:00:00.000Z',
      }),
      true,
    );
    assert.equal(
      patchMayAffectIssuedTickets(fixtureEventDetail, {
        startsAt: fixtureEventDetail.startsAt,
        venueName: fixtureEventDetail.venue!.name,
        venueAddress: fixtureEventDetail.venue!.address,
      }),
      false,
    );
  });
});

describe('C-E body builders and BFF parsers', () => {
  it('builds patch/clone/cancel bodies from contract fixtures', () => {
    const patch = buildPatchEventBody({
      expectedRevision: fixturePatchEvent.expectedRevision,
      startsAt: fixturePatchEvent.startsAt,
      confirmIssuedImpact: true,
      notifyAttendees: true,
    });
    assert.equal(patch.confirmIssuedImpact, true);
    assert.deepEqual(buildCloneEventBody(fixtureCloneEvent), fixtureCloneEvent);
    assert.deepEqual(
      buildCancelEventBody(fixtureCancelEvent),
      fixtureCancelEvent,
    );
  });

  it('parsePatchBody requires expectedRevision + idempotency UUID', async () => {
    const bad = parsePatchBody({ expectedRevision: 1 });
    assert.ok(bad instanceof Response);
    if (bad instanceof Response) {
      assert.equal(bad.status, 422);
      const json = (await bad.json()) as { code: string };
      assert.equal(json.code, 'IDEMPOTENCY_KEY_REQUIRED');
    }

    const ok = parsePatchBody({
      expectedRevision: 3,
      idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      startsAt: '2026-11-01T11:00:00.000Z',
      confirmIssuedImpact: true,
      venue: { name: 'Hall B', address: '2 Example St' },
    });
    assert.ok(!(ok instanceof Response));
    if (!(ok instanceof Response)) {
      assert.equal(ok.patch.expectedRevision, 3);
      assert.equal(ok.patch.venue?.name, 'Hall B');
      assert.equal(ok.patch.confirmIssuedImpact, true);
    }
  });

  it('parseClone/cancel/archive/impact allowlist fields only', async () => {
    const clone = parseCloneBody({
      slug: 'x',
      name: 'Y',
      copyConfig: true,
      idempotencyKey: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      staffIds: ['should-not-forward'],
    });
    assert.ok(!(clone instanceof Response));
    if (!(clone instanceof Response)) {
      assert.deepEqual(clone.clone, {
        slug: 'x',
        name: 'Y',
        copyConfig: true,
      });
    }

    const cancel = parseCancelBody({
      expectedRevision: 3,
      reason: 'Venue unavailable',
      notifyAttendees: true,
      idempotencyKey: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });
    assert.ok(!(cancel instanceof Response));

    const archive = parseArchiveBody({
      expectedRevision: 3,
      idempotencyKey: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    });
    assert.ok(!(archive instanceof Response));

    const impact = parseImpactBody({
      expectedRevision: 3,
      startsAt: '2026-11-01T11:00:00.000Z',
    });
    assert.ok(!(impact instanceof Response));
    if (!(impact instanceof Response)) {
      assert.equal(impact.startsAt, '2026-11-01T11:00:00.000Z');
    }
  });
});
