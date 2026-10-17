import { randomUUID } from 'node:crypto';
import {
  NOTIFICATION_KINDS,
  type NotificationKind,
  type NotificationTemplatePreviewResponse,
  type NotificationTemplateVariable,
} from '@ticket/contracts';
import type { Prisma } from './generated/prisma/client';
import { requireTenantPermission } from './membership';
import {
  NotificationError,
  NOTIFICATION_ERROR_CODES,
} from './notification-error';

const PERMISSION_CONFIG = 'event.config';

/** Allowlisted template variables for TicketIssued (and shared fallbacks). */
export const TICKET_ISSUED_TEMPLATE_VARS = [
  'eventName',
  'ticketId',
  'ticketLink',
  'guideText',
  'contactText',
] as const;

export type TicketIssuedTemplateVar =
  (typeof TICKET_ISSUED_TEMPLATE_VARS)[number];

const KIND_VARIABLES: Record<NotificationKind, readonly string[]> = {
  TicketIssued: TICKET_ISSUED_TEMPLATE_VARS,
  InvitationReady: ['eventName', 'ticketLink', 'guideText', 'contactText'],
  EventChanged: ['eventName', 'guideText', 'contactText'],
  EventCancelled: ['eventName', 'contactText'],
  EventReminder: ['eventName', 'ticketLink', 'guideText', 'contactText'],
};

export const DEFAULT_TICKET_ISSUED_TEMPLATE = {
  subject: 'Vé đã cấp — {{eventName}}',
  bodyText: [
    'Vé {{ticketId}} đã được cấp cho sự kiện {{eventName}}.',
    '',
    'Xem vé (đăng nhập bắt buộc): {{ticketLink}}',
    '',
    'Hướng dẫn:',
    '{{guideText}}',
    '',
    'Liên hệ:',
    '{{contactText}}',
    '',
    'QR vé đính kèm dùng credential hiện tại; không chia sẻ công khai.',
  ].join('\n'),
  bodyHtml: [
    '<p>Vé <strong>{{ticketId}}</strong> đã được cấp cho sự kiện <strong>{{eventName}}</strong>.</p>',
    '<p><a href="{{ticketLink}}">Xem vé</a> (đăng nhập bắt buộc)</p>',
    '<h2>Hướng dẫn</h2><p>{{guideText}}</p>',
    '<h2>Liên hệ</h2><p>{{contactText}}</p>',
    '<p>QR đính kèm dùng credential hiện tại.</p>',
  ].join(''),
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function extractTemplateVariables(source: string): string[] {
  const found = new Set<string>();
  const re = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    if (match[1]) found.add(match[1]);
  }
  return [...found];
}

export function validateTemplateLiterals(
  kind: NotificationKind,
  subject: string,
  bodyText: string,
  bodyHtml: string,
): NotificationTemplateVariable[] {
  if (!NOTIFICATION_KINDS.includes(kind)) {
    throw new NotificationError(
      NOTIFICATION_ERROR_CODES.KIND_UNSUPPORTED,
      `Unsupported notification kind: ${kind}`,
    );
  }
  if (!subject.trim() || subject.length > 200) {
    throw new NotificationError(
      NOTIFICATION_ERROR_CODES.TEMPLATE_INVALID,
      'subject must be 1..200 characters',
    );
  }
  if (!bodyText.trim() || bodyText.length > 20000) {
    throw new NotificationError(
      NOTIFICATION_ERROR_CODES.TEMPLATE_INVALID,
      'bodyText must be 1..20000 characters',
    );
  }
  if (!bodyHtml.trim() || bodyHtml.length > 40000) {
    throw new NotificationError(
      NOTIFICATION_ERROR_CODES.TEMPLATE_INVALID,
      'bodyHtml must be 1..40000 characters',
    );
  }
  // No script / event-handler / template execution beyond {{var}}.
  if (/<\s*script/i.test(bodyHtml) || /\bon\w+\s*=/i.test(bodyHtml)) {
    throw new NotificationError(
      NOTIFICATION_ERROR_CODES.TEMPLATE_INVALID,
      'bodyHtml must not contain script or event handlers',
    );
  }
  const allow = new Set(KIND_VARIABLES[kind]);
  const used = new Set([
    ...extractTemplateVariables(subject),
    ...extractTemplateVariables(bodyText),
    ...extractTemplateVariables(bodyHtml),
  ]);
  for (const name of used) {
    if (!allow.has(name)) {
      throw new NotificationError(
        NOTIFICATION_ERROR_CODES.TEMPLATE_UNSUPPORTED_VARIABLE,
        `Unsupported template variable: ${name}`,
      );
    }
  }
  return [...used].map((name) => ({
    name,
    description: `Allowlisted variable ${name}`,
  }));
}

export function renderTemplate(
  source: string,
  variables: Record<string, string>,
  mode: 'text' | 'html',
): string {
  return source.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_, name: string) => {
    const raw = variables[name] ?? '';
    return mode === 'html' ? escapeHtml(raw) : raw;
  });
}

export function renderEscapedPreview(
  subject: string,
  bodyText: string,
  bodyHtml: string,
  sampleVariables: Record<string, string>,
): NotificationTemplatePreviewResponse {
  return {
    subject: renderTemplate(subject, sampleVariables, 'text'),
    bodyText: renderTemplate(bodyText, sampleVariables, 'text'),
    bodyHtml: renderTemplate(bodyHtml, sampleVariables, 'html'),
    escaped: true,
  };
}

export async function previewNotificationTemplate(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    kind: NotificationKind;
    subject: string;
    bodyText: string;
    bodyHtml: string;
    sampleVariables: Record<string, string>;
  },
): Promise<NotificationTemplatePreviewResponse> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_CONFIG,
    eventId: input.eventId,
  });
  validateTemplateLiterals(
    input.kind,
    input.subject,
    input.bodyText,
    input.bodyHtml,
  );
  return renderEscapedPreview(
    input.subject,
    input.bodyText,
    input.bodyHtml,
    input.sampleVariables,
  );
}

export async function publishNotificationTemplate(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    kind: NotificationKind;
    subject: string;
    bodyText: string;
    bodyHtml: string;
  },
): Promise<{ templateId: string; version: number }> {
  await requireTenantPermission(tx, {
    tenantId: input.tenantId,
    userId: input.actorUserId,
    permission: PERMISSION_CONFIG,
    eventId: input.eventId,
  });
  const variables = validateTemplateLiterals(
    input.kind,
    input.subject,
    input.bodyText,
    input.bodyHtml,
  );

  const existing = await tx.$queryRaw<Array<{ id: string; published_version: number | null }>>`
    SELECT id, published_version FROM notification_templates
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND kind = ${input.kind}
    FOR UPDATE
  `;

  let templateId = existing[0]?.id;
  if (!templateId) {
    templateId = randomUUID();
    await tx.$executeRaw`
      INSERT INTO notification_templates (
        tenant_id, event_id, id, kind, published_version, created_at, updated_at
      ) VALUES (
        ${input.tenantId}::uuid, ${input.eventId}::uuid, ${templateId}::uuid,
        ${input.kind}, NULL, now(), now()
      )
    `;
  }

  const nextVersion = (existing[0]?.published_version ?? 0) + 1;
  await tx.$executeRaw`
    INSERT INTO notification_template_versions (
      tenant_id, template_id, version, subject, body_text, body_html,
      variables, published_at, created_by, created_at
    ) VALUES (
      ${input.tenantId}::uuid, ${templateId}::uuid, ${nextVersion}::integer,
      ${input.subject}, ${input.bodyText}, ${input.bodyHtml},
      ${JSON.stringify(variables)}::jsonb, clock_timestamp(),
      ${input.actorUserId}::uuid, now()
    )
  `;
  await tx.$executeRaw`
    UPDATE notification_templates
    SET published_version = ${nextVersion}::integer, updated_at = now()
    WHERE tenant_id = ${input.tenantId}::uuid AND id = ${templateId}::uuid
  `;
  return { templateId, version: nextVersion };
}

export type ResolvedTemplate = {
  version: number | null;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  fromDefault: boolean;
};

export async function resolveTicketIssuedTemplate(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
  snapshotVersion?: number | null,
): Promise<ResolvedTemplate> {
  if (snapshotVersion != null) {
    const rows = await tx.$queryRaw<
      Array<{ version: number; subject: string; body_text: string; body_html: string }>
    >`
      SELECT v.version, v.subject, v.body_text, v.body_html
      FROM notification_template_versions v
      JOIN notification_templates t
        ON t.tenant_id = v.tenant_id AND t.id = v.template_id
      WHERE t.tenant_id = ${tenantId}::uuid
        AND t.event_id = ${eventId}::uuid
        AND t.kind = 'TicketIssued'
        AND v.version = ${snapshotVersion}::integer
      LIMIT 1
    `;
    const row = rows[0];
    if (row) {
      try {
        validateTemplateLiterals(
          'TicketIssued',
          row.subject,
          row.body_text,
          row.body_html,
        );
        return {
          version: row.version,
          subject: row.subject,
          bodyText: row.body_text,
          bodyHtml: row.body_html,
          fromDefault: false,
        };
      } catch {
        // Invalid custom → default fallback.
      }
    }
  }

  const published = await tx.$queryRaw<
    Array<{ version: number; subject: string; body_text: string; body_html: string }>
  >`
    SELECT v.version, v.subject, v.body_text, v.body_html
    FROM notification_templates t
    JOIN notification_template_versions v
      ON v.tenant_id = t.tenant_id
     AND v.template_id = t.id
     AND v.version = t.published_version
    WHERE t.tenant_id = ${tenantId}::uuid
      AND t.event_id = ${eventId}::uuid
      AND t.kind = 'TicketIssued'
    LIMIT 1
  `;
  const row = published[0];
  if (row) {
    try {
      validateTemplateLiterals(
        'TicketIssued',
        row.subject,
        row.body_text,
        row.body_html,
      );
      return {
        version: row.version,
        subject: row.subject,
        bodyText: row.body_text,
        bodyHtml: row.body_html,
        fromDefault: false,
      };
    } catch {
      // fall through
    }
  }
  return {
    version: null,
    ...DEFAULT_TICKET_ISSUED_TEMPLATE,
    fromDefault: true,
  };
}

export function readPublishedGuideContact(payload: unknown): {
  guideText: string;
  contactText: string;
} {
  const root =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const guide =
    typeof root['guide'] === 'string'
      ? root['guide']
      : typeof root['guideText'] === 'string'
        ? root['guideText']
        : 'Vui lòng mang theo vé điện tử khi check-in.';
  const contact =
    typeof root['contact'] === 'string'
      ? root['contact']
      : typeof root['contactText'] === 'string'
        ? root['contactText']
        : 'Liên hệ ban tổ chức qua cổng sự kiện.';
  return {
    guideText: guide.slice(0, 4000),
    contactText: contact.slice(0, 2000),
  };
}
