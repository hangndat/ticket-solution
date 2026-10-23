import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseReminderCreateBody,
  parseReminderPreviewBody,
  parseTemplatePreviewBody,
  parseTemplatePublishBody,
} from '../src/bff/notification-bff-body';
import { PORTAL_UPSTREAM } from '../src/bff/paths';
import {
  bffNotificationTemplatePreview,
  bffNotificationTemplatePublish,
  bffReminderCancel,
  bffReminderPreview,
  bffReminders,
} from '../src/prep/bff-urls';
import { notificationEndpointTemplates } from '../src/ops/notifications';

const TENANT = '11111111-1111-4111-8111-111111111111';
const EVENT = '22222222-2222-4222-8222-222222222222';
const IDEM = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

describe('portal C-N BFF paths', () => {
  it('maps client BFF URLs under tenant/event scope', () => {
    assert.equal(
      bffNotificationTemplatePreview(TENANT, EVENT),
      `/api/bff/tenants/${TENANT}/events/${EVENT}/notification-templates/preview`,
    );
    assert.equal(
      bffNotificationTemplatePublish(TENANT, EVENT),
      `/api/bff/tenants/${TENANT}/events/${EVENT}/notification-templates/publish`,
    );
    assert.equal(
      bffReminderPreview(TENANT, EVENT),
      `/api/bff/tenants/${TENANT}/events/${EVENT}/reminders/preview`,
    );
    assert.equal(
      bffReminders(TENANT, EVENT),
      `/api/bff/tenants/${TENANT}/events/${EVENT}/reminders`,
    );
    assert.match(
      bffReminderCancel(TENANT, EVENT, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
      /\/reminders\/dddddddd-dddd-4ddd-8ddd-dddddddddddd\/cancel$/,
    );
  });

  it('mirrors upstream Nest paths', () => {
    assert.match(
      PORTAL_UPSTREAM.notificationTemplatePreview(TENANT, EVENT),
      /notification-templates\/preview$/,
    );
    assert.match(
      PORTAL_UPSTREAM.notificationTemplatePublish(TENANT, EVENT),
      /notification-templates\/publish$/,
    );
    assert.match(PORTAL_UPSTREAM.reminderPreview(TENANT, EVENT), /reminders\/preview$/);
    assert.match(PORTAL_UPSTREAM.reminders(TENANT, EVENT), /\/reminders$/);
    assert.match(
      PORTAL_UPSTREAM.reminderCancel(
        TENANT,
        EVENT,
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      ),
      /\/cancel$/,
    );
  });

  it('documents portal endpoint templates', () => {
    const endpoints = notificationEndpointTemplates();
    assert.match(endpoints.templatePreview, /tenants\/:tenantId\/events\/:eventId/);
    assert.match(endpoints.reminderCancel, /reminders\/:reminderId\/cancel/);
  });
});

describe('portal notification-bff-body parsers', () => {
  it('rejects template preview without kind', async () => {
    const bad = parseTemplatePreviewBody({
      subject: 's',
      bodyText: 't',
      bodyHtml: '<p>t</p>',
    });
    assert.ok(bad instanceof Response);
    assert.equal(bad.status, 422);
  });

  it('accepts template preview payload', () => {
    const ok = parseTemplatePreviewBody({
      kind: 'TicketIssued',
      subject: 'Hello',
      bodyText: 'Body',
      bodyHtml: '<p>Body</p>',
      sampleVariables: { eventName: 'Demo' },
    });
    assert.ok(!(ok instanceof Response));
    assert.equal(ok.payload.kind, 'TicketIssued');
    assert.equal(ok.payload.sampleVariables?.eventName, 'Demo');
  });

  it('requires idempotency key for publish', () => {
    const bad = parseTemplatePublishBody({
      kind: 'TicketIssued',
      subject: 's',
      bodyText: 't',
      bodyHtml: '<p>t</p>',
    });
    assert.ok(bad instanceof Response);
    const ok = parseTemplatePublishBody({
      kind: 'TicketIssued',
      subject: 's',
      bodyText: 't',
      bodyHtml: '<p>t</p>',
      idempotencyKey: IDEM,
    });
    assert.ok(!(ok instanceof Response));
    assert.equal(ok.idempotencyKey, IDEM);
  });

  it('validates reminder UTC schedule', () => {
    const bad = parseReminderPreviewBody({
      expectedEventRevision: 1,
      scheduledAt: '2026-12-01T10:00:00',
    });
    assert.ok(bad instanceof Response);
    const ok = parseReminderPreviewBody({
      expectedEventRevision: 1,
      scheduledAt: '2026-12-01T10:00:00Z',
    });
    assert.ok(!(ok instanceof Response));
    assert.equal(ok.payload.expectedEventRevision, 1);
  });

  it('forces transactional reminder create', () => {
    const ok = parseReminderCreateBody({
      expectedEventRevision: 2,
      scheduledAt: '2026-12-01T10:00:00Z',
      idempotencyKey: IDEM,
    });
    assert.ok(!(ok instanceof Response));
    assert.equal(ok.payload.audience, 'TICKET_OWNERS');
  });
});
