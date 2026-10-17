import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  NOTIFICATION_ERROR_CODES,
  NOTIFICATION_KINDS,
  NOTIFICATION_REMINDER_CANCEL_COMMAND,
  NOTIFICATION_REMINDER_CREATE_COMMAND,
  NOTIFICATION_RETRY_COMMAND,
  NOTIFICATION_TEMPLATE_PUBLISH_COMMAND,
} from '@ticket/contracts';
import {
  parseReminderCreateBody,
  parseReminderPreviewBody,
  parseRetryBody,
  parseTemplatePreviewBody,
  parseTemplatePublishBody,
} from '../src/admin/notification-bff-body';
import {
  DEFAULT_TICKET_ISSUED_DRAFT,
  NOTIFICATION_UNKNOWN,
  TEMPLATE_VARIABLES_BY_KIND,
  buildReminderCreateBody,
  interpretNotificationList,
  interpretNotificationRetry,
  interpretReminderCancel,
  interpretReminderCreate,
  interpretReminderPreview,
  interpretTemplatePreview,
  interpretTemplatePublish,
  isRevisionConflict,
  localDateTimeToUtcIso,
  notificationCommands,
  notificationEndpointTemplates,
  notificationListLabel,
  notificationRetryLabel,
  providerStatusLabel,
  reminderCreateFingerprint,
  reminderCreateLabel,
  resolveNotificationIdempotencyKey,
  templatePreviewLabel,
} from '../src/admin/notifications';

const TENANT = '11111111-1111-4111-8111-111111111111';
const EVENT = '22222222-2222-4222-8222-222222222222';
const NOTE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const REMINDER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const IDEM = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

describe('C-N contracts mirrored in web', () => {
  it('exposes BFF endpoint templates and frozen commands', () => {
    const endpoints = notificationEndpointTemplates();
    assert.match(endpoints.templatePreview, /notification-templates\/preview/);
    assert.match(endpoints.reminderCreate, /reminders$/);
    assert.match(endpoints.retry, /notifications\/:notificationId\/retry/);
    const cmds = notificationCommands();
    assert.equal(cmds.templatePublish, NOTIFICATION_TEMPLATE_PUBLISH_COMMAND);
    assert.equal(cmds.reminderCreate, NOTIFICATION_REMINDER_CREATE_COMMAND);
    assert.equal(cmds.reminderCancel, NOTIFICATION_REMINDER_CANCEL_COMMAND);
    assert.equal(cmds.retry, NOTIFICATION_RETRY_COMMAND);
  });

  it('keeps allowlisted kinds and TicketIssued variables', () => {
    assert.deepEqual([...NOTIFICATION_KINDS], [
      'TicketIssued',
      'InvitationReady',
      'EventChanged',
      'EventCancelled',
      'EventReminder',
    ]);
    assert.ok(TEMPLATE_VARIABLES_BY_KIND.TicketIssued.includes('ticketLink'));
    assert.ok(DEFAULT_TICKET_ISSUED_DRAFT.subject.includes('{{eventName}}'));
  });
});

describe('provider status honesty', () => {
  it('never labels ACCEPTED as delivered', () => {
    const label = providerStatusLabel('ACCEPTED');
    assert.match(label, /ACCEPTED/);
    // Explicit inequality — must not read as a delivery success claim.
    assert.match(label, /≠ đã giao/);
    assert.equal(/^ACCEPTED \(delivered\)$/i.test(label), false);
    assert.equal(label.includes('đã giao thành công'), false);
  });

  it('keeps UNKNOWN and DEAD distinct from success', () => {
    assert.match(providerStatusLabel('UNKNOWN'), /UNKNOWN/);
    assert.match(providerStatusLabel('DEAD'), /DEAD/);
    assert.match(providerStatusLabel('PENDING'), /PENDING/);
  });
});

describe('interpretNotificationList', () => {
  it('parses summaries without PII and keeps ACCEPTED as-is', () => {
    const view = interpretNotificationList(
      200,
      {
        items: [
          {
            notificationId: NOTE,
            kind: 'TicketIssued',
            payloadVersion: 1,
            channel: 'email',
            providerStatus: 'ACCEPTED',
            attempts: 1,
            nextAttemptAt: null,
          },
        ],
        nextCursor: null,
      },
      false,
    );
    assert.equal(view.kind, 'list');
    if (view.kind === 'list') {
      assert.equal(view.items[0]!.providerStatus, 'ACCEPTED');
      const text = notificationListLabel(view);
      assert.match(text, /ACCEPTED ≠ delivered/);
      assert.equal(JSON.stringify(view).includes('@'), false);
    }
  });

  it('rejects raw email/token fields in list payloads', () => {
    const withEmail = interpretNotificationList(
      200,
      {
        items: [
          {
            notificationId: NOTE,
            kind: 'TicketIssued',
            payloadVersion: 1,
            channel: 'email',
            providerStatus: 'ACCEPTED',
            attempts: 1,
            nextAttemptAt: null,
            email: 'victim@example.com',
          },
        ],
        nextCursor: null,
      },
      false,
    );
    assert.equal(withEmail.kind, 'unknown');

    const withToken = interpretNotificationList(
      200,
      {
        items: [
          {
            notificationId: NOTE,
            kind: 'TicketIssued',
            payloadVersion: 1,
            channel: 'email',
            providerStatus: 'PENDING',
            attempts: 0,
            nextAttemptAt: null,
            token: 'raw-secret-token',
          },
        ],
        nextCursor: null,
      },
      false,
    );
    assert.equal(withToken.kind, 'unknown');
  });

  it('maps 403 permission and 5xx to rejected/unknown', () => {
    const denied = interpretNotificationList(
      403,
      {
        code: 'PERMISSION_DENIED',
        message: 'Missing event permission: event.config',
      },
      false,
    );
    assert.equal(denied.kind, 'rejected');
    if (denied.kind === 'rejected') {
      assert.equal(denied.code, 'PERMISSION_DENIED');
    }
    assert.equal(
      interpretNotificationList(503, { items: [] }, false).kind,
      'unknown',
    );
    assert.equal(interpretNotificationList(0, null, true).kind, 'unknown');
  });
});

describe('interpretTemplatePreview / publish', () => {
  it('requires escaped:true and surfaces subject safely', () => {
    const ok = interpretTemplatePreview(
      200,
      {
        subject: 'Hello &lt;Ada&gt;',
        bodyText: 'Hello Ada',
        bodyHtml: '<p>Hello Ada</p>',
        escaped: true,
      },
      false,
    );
    assert.equal(ok.kind, 'preview');
    if (ok.kind === 'preview') {
      assert.match(templatePreviewLabel(ok), /escaped/i);
    }
    const missingFlag = interpretTemplatePreview(
      200,
      {
        subject: 'x',
        bodyText: 'y',
        bodyHtml: 'z',
      },
      false,
    );
    assert.equal(missingFlag.kind, 'unknown');
  });

  it('rejects script-looking PII keys and accepts publish version', () => {
    assert.equal(
      interpretTemplatePreview(
        200,
        {
          subject: 'x',
          bodyText: 'y',
          bodyHtml: 'z',
          escaped: true,
          token: 'secret',
        },
        false,
      ).kind,
      'unknown',
    );
    const published = interpretTemplatePublish(
      201,
      { templateId: NOTE, version: 2 },
      false,
    );
    assert.deepEqual(published, {
      kind: 'published',
      templateId: NOTE,
      version: 2,
    });
    assert.equal(
      interpretTemplatePublish(422, {
        code: NOTIFICATION_ERROR_CODES.TEMPLATE_INVALID,
        message: 'unknown var',
      }, false).kind,
      'rejected',
    );
  });
});

describe('interpretReminder*', () => {
  it('preview only accepts recipientCount (no emails list)', () => {
    const ok = interpretReminderPreview(
      200,
      {
        recipientCount: 42,
        scheduledAt: '2026-10-31T01:00:00.000Z',
        eventRevision: 3,
      },
      false,
    );
    assert.equal(ok.kind, 'preview');
    if (ok.kind === 'preview') {
      assert.equal(ok.recipientCount, 42);
    }
    const withEmails = interpretReminderPreview(
      200,
      {
        recipientCount: 2,
        scheduledAt: '2026-10-31T01:00:00.000Z',
        eventRevision: 3,
        emails: ['a@b.c', 'd@e.f'],
      },
      false,
    );
    assert.equal(withEmails.kind, 'unknown');
  });

  it('surfaces REVISION_CONFLICT for stale expectedRevision', () => {
    const conflict = interpretReminderPreview(
      409,
      {
        code: NOTIFICATION_ERROR_CODES.REVISION_CONFLICT,
        message: 'expectedEventRevision stale',
      },
      false,
    );
    assert.equal(conflict.kind, 'rejected');
    if (conflict.kind === 'rejected') {
      assert.equal(isRevisionConflict(conflict.code), true);
    }
  });

  it('create success / unknown / cancel', () => {
    const created = interpretReminderCreate(
      201,
      {
        reminderId: REMINDER,
        eventId: EVENT,
        scheduledAt: '2026-10-31T01:00:00.000Z',
        status: 'SCHEDULED',
        eventRevision: 3,
      },
      false,
    );
    assert.equal(created.kind, 'created');
    if (created.kind === 'created') {
      assert.match(reminderCreateLabel(created), /Đã tạo nhắc/);
    }
    assert.equal(
      interpretReminderCreate(503, { reminderId: REMINDER }, false).kind,
      'unknown',
    );
    assert.equal(interpretReminderCreate(0, null, true).kind, 'unknown');
    assert.equal(
      interpretReminderCreate(0, null, true).kind === 'unknown'
        ? NOTIFICATION_UNKNOWN
        : '',
      NOTIFICATION_UNKNOWN,
    );

    const cancelled = interpretReminderCancel(
      200,
      {
        reminderId: REMINDER,
        eventId: EVENT,
        scheduledAt: '2026-10-31T01:00:00.000Z',
        status: 'CANCELLED',
        eventRevision: 3,
      },
      false,
    );
    assert.equal(cancelled.kind, 'cancelled');
  });
});

describe('interpretNotificationRetry', () => {
  it('requeue is PENDING only — ACCEPTED alone is invalid success', () => {
    const ok = interpretNotificationRetry(
      200,
      { notificationId: NOTE, requeued: true },
      false,
    );
    assert.deepEqual(ok, {
      kind: 'requeued',
      notificationId: NOTE,
      providerStatus: 'PENDING',
    });
    assert.match(notificationRetryLabel(ok), /PENDING/);
    assert.equal(
      interpretNotificationRetry(
        200,
        { notificationId: NOTE, providerStatus: 'ACCEPTED' },
        false,
      ).kind,
      'unknown',
    );
  });
});

describe('unknown does not duplicate schedule key', () => {
  it('reuses idempotency key when previous create was unclear', () => {
    const fingerprint = reminderCreateFingerprint({
      tenantId: TENANT,
      eventId: EVENT,
      expectedEventRevision: 3,
      scheduledAt: '2026-10-31T01:00:00.000Z',
    });
    const first = resolveNotificationIdempotencyKey(null, fingerprint, () => IDEM);
    assert.equal(first.reused, false);
    const unclear = {
      key: first.key,
      fingerprint,
      unclear: true,
    };
    const second = resolveNotificationIdempotencyKey(
      unclear,
      fingerprint,
      () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    );
    assert.equal(second.reused, true);
    assert.equal(second.key, IDEM);

    const changed = resolveNotificationIdempotencyKey(
      unclear,
      reminderCreateFingerprint({
        tenantId: TENANT,
        eventId: EVENT,
        expectedEventRevision: 4,
        scheduledAt: '2026-10-31T01:00:00.000Z',
      }),
      () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    assert.equal(changed.reused, false);
  });
});

describe('local→UTC and reminder body builders', () => {
  it('converts datetime-local to UTC ISO with Z', () => {
    const iso = localDateTimeToUtcIso('2026-10-31T08:00');
    assert.ok(iso);
    assert.match(iso!, /Z$/);
    assert.equal(localDateTimeToUtcIso('not-a-date'), null);
    const body = buildReminderCreateBody({
      expectedEventRevision: 2,
      scheduledAt: iso!,
    });
    assert.equal(body.kind, 'EventReminder');
    assert.equal(body.audience, 'TICKET_OWNERS');
  });
});

describe('BFF body allowlists', () => {
  it('template preview requires scope + kind + texts', () => {
    const bad = parseTemplatePreviewBody({
      tenantId: 'x',
      eventId: EVENT,
      kind: 'TicketIssued',
      subject: 's',
      bodyText: 't',
      bodyHtml: 'h',
    });
    assert.ok(bad instanceof Response);

    const ok = parseTemplatePreviewBody({
      tenantId: TENANT,
      eventId: EVENT,
      kind: 'TicketIssued',
      subject: 's',
      bodyText: 't',
      bodyHtml: 'h',
      sampleVariables: { eventName: 'Demo' },
    });
    assert.equal(ok instanceof Response, false);
    if (!(ok instanceof Response)) {
      assert.equal(ok.payload.kind, 'TicketIssued');
      assert.equal(ok.payload.sampleVariables.eventName, 'Demo');
    }
  });

  it('publish and retry require Idempotency-Key + reason', () => {
    const noKey = parseTemplatePublishBody({
      tenantId: TENANT,
      eventId: EVENT,
      kind: 'TicketIssued',
      subject: 's',
      bodyText: 't',
      bodyHtml: 'h',
    });
    assert.ok(noKey instanceof Response);

    const pub = parseTemplatePublishBody({
      tenantId: TENANT,
      eventId: EVENT,
      kind: 'TicketIssued',
      subject: 's',
      bodyText: 't',
      bodyHtml: 'h',
      idempotencyKey: IDEM,
    });
    assert.equal(pub instanceof Response, false);

    const noReason = parseRetryBody({
      tenantId: TENANT,
      eventId: EVENT,
      idempotencyKey: IDEM,
    });
    assert.ok(noReason instanceof Response);

    const retry = parseRetryBody({
      tenantId: TENANT,
      eventId: EVENT,
      idempotencyKey: IDEM,
      reason: 'staff retry after FAILED',
    });
    assert.equal(retry instanceof Response, false);
  });

  it('reminder create rejects marketing audience and naive datetime', () => {
    const marketing = parseReminderCreateBody({
      tenantId: TENANT,
      eventId: EVENT,
      idempotencyKey: IDEM,
      expectedEventRevision: 1,
      scheduledAt: '2026-10-31T01:00:00.000Z',
      audience: 'ALL_SUBSCRIBERS',
    });
    assert.ok(marketing instanceof Response);

    const naive = parseReminderPreviewBody({
      tenantId: TENANT,
      eventId: EVENT,
      expectedEventRevision: 1,
      scheduledAt: '2026-10-31T01:00:00',
    });
    assert.ok(naive instanceof Response);

    const ok = parseReminderCreateBody({
      tenantId: TENANT,
      eventId: EVENT,
      idempotencyKey: IDEM,
      expectedEventRevision: 1,
      scheduledAt: '2026-10-31T01:00:00.000Z',
      audience: 'TICKET_OWNERS',
      kind: 'EventReminder',
    });
    assert.equal(ok instanceof Response, false);
    if (!(ok instanceof Response)) {
      assert.equal(ok.payload.audience, 'TICKET_OWNERS');
      assert.match(ok.payload.scheduledAt, /Z$/);
    }
  });
});
