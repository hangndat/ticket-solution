/**
 * SMTP / sandbox email adapter (ADR-13).
 * Delivery failures must never roll back an already-committed ticket.
 */
import { sendMailViaSmtp } from './smtp-send';

export type TicketIssuedEmailPayload = {
  tenantId: string;
  eventId: string;
  ticketId: string;
  toEmail: string | null;
  requestId: string;
};

export type EmailSendResult = {
  providerRef: string;
};

export type EmailAdapter = {
  sendTicketIssued(
    payload: TicketIssuedEmailPayload,
  ): Promise<EmailSendResult>;
};

/** Always succeeds — used in unit/dev when SMTP is unavailable. */
export function createNoopEmailAdapter(): EmailAdapter {
  return {
    async sendTicketIssued(payload) {
      return { providerRef: `noop:${payload.ticketId}` };
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
  };
}

export type SmtpAdapterOptions = {
  /** e.g. smtp://127.0.0.1:1025 for Mailpit. Empty → noop. */
  smtpUrl?: string;
  fromAddress?: string;
};

/**
 * Minimal SMTP adapter. If smtpUrl is unset, falls back to noop (local/dev).
 * Does not use SaaS transactional providers (ADR-11/13).
 */
export function createSmtpEmailAdapter(
  options: SmtpAdapterOptions = {},
): EmailAdapter {
  const smtpUrl = options.smtpUrl?.trim();
  if (!smtpUrl) return createNoopEmailAdapter();

  return {
    async sendTicketIssued(payload) {
      const from = options.fromAddress ?? 'tickets@localhost';
      const to = payload.toEmail ?? 'undeliverable@localhost';
      const subject = `Vé đã cấp — ${payload.ticketId}`;
      const body = [
        `Ticket ${payload.ticketId} đã được cấp.`,
        `Event: ${payload.eventId}`,
        `Request: ${payload.requestId}`,
        '',
        'Đây là email sandbox (Mailpit / self-host SMTP).',
      ].join('\n');
      const providerRef = await sendMailViaSmtp({
        smtpUrl,
        from,
        to,
        subject,
        body,
      });
      return { providerRef };
    },
  };
}

export function readEmailEnvironment(env: NodeJS.ProcessEnv): SmtpAdapterOptions {
  return {
    smtpUrl: env['SMTP_URL']?.trim() || undefined,
    fromAddress: env['SMTP_FROM']?.trim() || undefined,
  };
}
