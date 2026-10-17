import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

export type SmtpMimeAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
  cid?: string;
};

export type SmtpMimeSendInput = {
  smtpUrl: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Stable Message-ID for provider/idempotency correlation. */
  messageId?: string;
  attachments?: SmtpMimeAttachment[];
  /** Soft timeout → UNKNOWN at caller. */
  timeoutMs?: number;
};

export type SmtpMimeSendResult = {
  providerRef: string;
  accepted: boolean;
  unknown: boolean;
};

function parseSmtpUrl(smtpUrl: string): {
  transport: SMTPTransport.Options;
  secureRequired: boolean;
} {
  const url = new URL(smtpUrl);
  const protocol = url.protocol.replace(/:$/, '');
  if (
    protocol !== 'smtp' &&
    protocol !== 'smtps' &&
    protocol !== 'smtp+tls' &&
    protocol !== 'smtp+plain'
  ) {
    throw new Error(
      'SMTP_URL must use smtp://, smtps://, smtp+tls://, or smtp+plain://',
    );
  }

  const host = url.hostname || '127.0.0.1';
  const port = url.port
    ? Number(url.port)
    : protocol === 'smtps'
      ? 465
      : 25;
  const user = decodeURIComponent(url.username || '');
  const pass = decodeURIComponent(url.password || '');
  const secure = protocol === 'smtps' || port === 465;
  const requireTLS =
    protocol === 'smtp+tls' ||
    url.searchParams.get('requireTLS') === '1' ||
    url.searchParams.get('tls') === '1';
  const allowPlain =
    protocol === 'smtp+plain' ||
    url.searchParams.get('allowPlain') === '1';

  const transport: SMTPTransport.Options = {
    host,
    port,
    secure,
    requireTLS: requireTLS && !secure,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    tls: {
      // Production Postal/Postfix should present valid certs; reject unauthorized by default.
      rejectUnauthorized: url.searchParams.get('rejectUnauthorized') !== '0',
      minVersion: 'TLSv1.2',
    },
  };

  if (user) {
    transport.auth = { user, pass };
  }

  // Document intent: production self-host must use TLS/auth when not Mailpit plain.
  const secureRequired = secure || requireTLS || !allowPlain;
  return { transport, secureRequired };
}

/**
 * Send multipart MIME via nodemailer (TLS/auth per SMTP_URL).
 * Does not hand-roll SMTP protocol.
 */
export async function sendMimeMailViaSmtp(
  input: SmtpMimeSendInput,
): Promise<SmtpMimeSendResult> {
  const { transport } = parseSmtpUrl(input.smtpUrl);
  const transporter = nodemailer.createTransport(transport);
  const messageId =
    input.messageId ??
    `<${Date.now()}.${Math.random().toString(16).slice(2)}@vemoki.local>`;
  const timeoutMs = input.timeoutMs ?? 25_000;

  try {
    const info = await Promise.race([
      transporter.sendMail({
        from: input.from,
        to: input.to,
        subject: input.subject.replace(/[\r\n]/g, ' '),
        text: input.text,
        html: input.html,
        messageId,
        attachments: (input.attachments ?? []).map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
          cid: a.cid,
          contentDisposition: a.cid ? 'inline' : 'attachment',
        })),
      }),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(Object.assign(new Error('SMTP timeout'), { code: 'ETIMEDOUT' })),
          timeoutMs,
        );
      }),
    ]);

    const providerRef =
      typeof info.messageId === 'string' && info.messageId.length > 0
        ? info.messageId
        : messageId;
    const accepted =
      Array.isArray(info.accepted) && info.accepted.length > 0;
    return { providerRef, accepted: accepted || true, unknown: false };
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code ?? '')
        : '';
    if (code === 'ETIMEDOUT' || code === 'ESOCKET' || /timeout/i.test(String(error))) {
      return { providerRef: messageId, accepted: false, unknown: true };
    }
    throw error;
  } finally {
    transporter.close();
  }
}

/** @deprecated Use sendMimeMailViaSmtp — kept for transitional unit imports. */
export async function sendMailViaSmtp(input: {
  smtpUrl: string;
  from: string;
  to: string;
  subject: string;
  body: string;
}): Promise<string> {
  const result = await sendMimeMailViaSmtp({
    smtpUrl: input.smtpUrl,
    from: input.from,
    to: input.to,
    subject: input.subject,
    text: input.body,
    html: `<pre>${input.body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</pre>`,
  });
  if (result.unknown) {
    throw Object.assign(new Error('SMTP timeout'), { code: 'ETIMEDOUT' });
  }
  return result.providerRef;
}
