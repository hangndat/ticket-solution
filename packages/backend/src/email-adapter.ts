/**
 * SMTP email adapter (ADR-13) — MIME text+HTML + inline QR PNG.
 * Delivery failures must never roll back an already-committed ticket.
 * Production missing SMTP is fail-closed (no silent noop success).
 */
import { sendMailViaSmtp, sendMimeMailViaSmtp } from './smtp-send';
import {
  NotificationError,
  NOTIFICATION_ERROR_CODES,
} from './notification-error';
import { resolveProductWebBaseUrl } from './web-links';

export type TicketIssuedEmailPayload = {
  tenantId: string;
  eventId: string;
  ticketId: string;
  toEmail: string | null;
  requestId: string;
  subject: string;
  text: string;
  html: string;
  qrPng: Buffer;
  /** Stable Message-ID / business correlation. */
  messageId?: string;
  credentialVersion: number;
  credentialTokenHash: string;
};

export type EmailSendResult = {
  providerRef: string;
  /** Provider accepted the message — never means end-user delivered. */
  providerStatus: 'ACCEPTED' | 'UNKNOWN';
};

export type MembershipInviteEmailPayload = {
  tenantId: string;
  inviteId: string;
  toEmail: string;
  role: string;
  /** Raw token — only for encrypted delivery path; never log. */
  token: string;
  expiresAt: string;
  /** Absolute accept URL (token in query). Never log. */
  acceptUrl?: string;
};

export type EmailAdapter = {
  sendTicketIssued(
    payload: TicketIssuedEmailPayload,
  ): Promise<EmailSendResult>;
  sendMembershipInvite?(
    payload: MembershipInviteEmailPayload,
  ): Promise<EmailSendResult>;
};

/** Always succeeds — explicit test/dev injection only. */
export function createNoopEmailAdapter(): EmailAdapter {
  return {
    async sendTicketIssued(payload) {
      return {
        providerRef: `noop:${payload.ticketId}`,
        providerStatus: 'ACCEPTED',
      };
    },
    async sendMembershipInvite(payload) {
      return {
        providerRef: `noop-invite:${payload.inviteId}`,
        providerStatus: 'ACCEPTED',
      };
    },
  };
}

/** Deterministic failing adapter for proving ticket survives email errors. */
export function createFailingEmailAdapter(
  message = 'sandbox email provider unavailable',
): EmailAdapter {
  return {
    async sendTicketIssued() {
      throw new Error(message);
    },
    async sendMembershipInvite() {
      throw new Error(message);
    },
  };
}

export function createMisconfiguredEmailAdapter(
  message = 'SMTP is not configured',
): EmailAdapter {
  return {
    async sendTicketIssued() {
      throw new NotificationError(
        NOTIFICATION_ERROR_CODES.SMTP_MISCONFIGURED,
        message,
        true,
      );
    },
  };
}

export type SmtpAdapterOptions = {
  /** e.g. smtp://127.0.0.1:1025 (Mailpit) or smtps://user:pass@postal:465 */
  smtpUrl?: string;
  fromAddress?: string;
  nodeEnv?: string;
  /** Explicit opt-in for local/dev noop when SMTP_URL unset. Never in production. */
  allowNoop?: boolean;
};

/**
 * Authenticated/TLS SMTP adapter. Production without SMTP_URL fails closed.
 * Does not use SaaS transactional providers (ADR-11/13).
 */
export function createSmtpEmailAdapter(
  options: SmtpAdapterOptions = {},
): EmailAdapter {
  const smtpUrl = options.smtpUrl?.trim();
  const nodeEnv = options.nodeEnv ?? process.env['NODE_ENV'] ?? 'development';
  if (!smtpUrl) {
    if (nodeEnv === 'production' || !options.allowNoop) {
      return createMisconfiguredEmailAdapter(
        'SMTP_URL is required (production fail-closed; noop only via EMAIL_ALLOW_NOOP=1 in non-production)',
      );
    }
    return createNoopEmailAdapter();
  }

  return {
    async sendTicketIssued(payload) {
      if (!payload.toEmail?.trim()) {
        throw new Error('ticket recipient email is missing');
      }
      if (!payload.qrPng?.length) {
        throw new Error('QR PNG is required for TicketIssued email');
      }
      const from = options.fromAddress ?? 'tickets@localhost';
      const cid = 'ticket-qr@vemoki';
      const htmlWithQr = payload.html.includes('cid:ticket-qr')
        ? payload.html
        : `${payload.html}<p><img src="cid:${cid}" alt="Ticket QR" /></p>`;

      const result = await sendMimeMailViaSmtp({
        smtpUrl,
        from,
        to: payload.toEmail.trim(),
        subject: payload.subject,
        text: payload.text,
        html: htmlWithQr,
        messageId: payload.messageId,
        attachments: [
          {
            filename: `ticket-${payload.ticketId}.png`,
            content: payload.qrPng,
            contentType: 'image/png',
            cid,
          },
        ],
      });

      return {
        providerRef: result.providerRef,
        providerStatus: result.unknown ? 'UNKNOWN' : 'ACCEPTED',
      };
    },
    async sendMembershipInvite(payload) {
      if (!payload.toEmail?.trim()) {
        throw new Error('invite recipient email is missing');
      }
      const from = options.fromAddress ?? 'tickets@localhost';
      const subject = 'Lời mời tham gia tenant';
      const acceptUrl =
        payload.acceptUrl?.trim() ||
        (payload.token
          ? `(token length ${payload.token.length} — set PUBLIC_WEB_BASE_URL for accept link)`
          : '');
      const body = [
        `Bạn được mời với vai trò ${payload.role}.`,
        `Invite: ${payload.inviteId}`,
        `Hết hạn: ${payload.expiresAt}`,
        '',
        acceptUrl.startsWith('http')
          ? `Mở liên kết để chấp nhận: ${acceptUrl}`
          : 'Thiếu PUBLIC_WEB_BASE_URL — không tạo được link accept (worker misconfigured).',
      ].join('\n');
      const providerRef = await sendMailViaSmtp({
        smtpUrl,
        from,
        to: payload.toEmail.trim(),
        subject,
        body,
      });
      return { providerRef, providerStatus: 'ACCEPTED' };
    },
  };
}

export function readEmailEnvironment(env: NodeJS.ProcessEnv): SmtpAdapterOptions {
  const nodeEnv = env['NODE_ENV'] ?? 'development';
  const allowNoop =
    nodeEnv !== 'production' && env['EMAIL_ALLOW_NOOP'] === '1';
  return {
    smtpUrl: env['SMTP_URL']?.trim() || undefined,
    fromAddress: env['SMTP_FROM']?.trim() || undefined,
    nodeEnv,
    allowNoop,
  };
}

export function readPublicWebBaseUrl(env: NodeJS.ProcessEnv): string {
  const value = env['PUBLIC_WEB_BASE_URL']?.trim();
  if (value) {
    const url = new URL(value);
    if (url.protocol !== 'https:' && env['NODE_ENV'] === 'production') {
      throw new NotificationError(
        NOTIFICATION_ERROR_CODES.SMTP_MISCONFIGURED,
        'PUBLIC_WEB_BASE_URL must be https in production',
      );
    }
    // O13: marketing apex must not be the invite/ticket deep-link base.
    return resolveProductWebBaseUrl(value);
  }
  if (env['NODE_ENV'] === 'production') {
    throw new NotificationError(
      NOTIFICATION_ERROR_CODES.SMTP_MISCONFIGURED,
      'PUBLIC_WEB_BASE_URL is required in production',
    );
  }
  return 'http://127.0.0.1:3000';
}
