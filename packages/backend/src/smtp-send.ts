import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { connect as connectNet, isIP, type Socket } from 'node:net';
import { connect as connectTls } from 'node:tls';
import { metricsObserveSeconds } from './metrics-registry';

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

export class SmtpDefiniteRejectError extends Error {
  readonly definiteNoAccept = true;
  constructor() {
    super('smtp_definite_reject');
  }
}

/** Validation failed before a socket or SMTP command could accept the mail. */
export class SmtpPreflightError extends Error {
  readonly definiteNoAccept = true;
}

export function isSmtpDefiniteReject(error: unknown): boolean {
  return error instanceof SmtpDefiniteRejectError ||
    (error instanceof Error && 'definiteNoAccept' in error && error.definiteNoAccept === true);
}

function parseSmtpUrl(smtpUrl: string): {
  transport: SMTPTransport.Options;
  secureRequired: boolean;
} {
  let url: URL;
  try {
    url = new URL(smtpUrl);
  } catch {
    throw new SmtpPreflightError('SMTP_URL is invalid');
  }
  const protocol = url.protocol.replace(/:$/, '');
  if (
    protocol !== 'smtp' &&
    protocol !== 'smtps' &&
    protocol !== 'smtp+tls' &&
    protocol !== 'smtp+plain'
  ) {
    throw new SmtpPreflightError(
      'SMTP_URL must use smtp://, smtps://, smtp+tls://, or smtp+plain://',
    );
  }

  const host = url.hostname || '127.0.0.1';
  const port = url.port ? Number(url.port) : protocol === 'smtps' ? 465 : 25;
  const user = decodeURIComponent(url.username || '');
  const pass = decodeURIComponent(url.password || '');
  const secure = protocol === 'smtps' || port === 465;
  const requireTLS =
    protocol === 'smtp+tls' ||
    url.searchParams.get('requireTLS') === '1' ||
    url.searchParams.get('tls') === '1';
  const allowPlain =
    protocol === 'smtp+plain' || url.searchParams.get('allowPlain') === '1';

  const transport: SMTPTransport.Options = {
    host,
    port,
    secure,
    requireTLS: requireTLS && !secure,
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 5_000,
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
  const sockets = new Set<Socket>();
  // Own the active socket so the deadline can abort an in-flight SMTP exchange.
  transport.getSocket = (_options, callback) => {
    const host = String(transport.host);
    const port = Number(transport.port);
    const secure = Boolean(transport.secure);
    const socket = secure
      ? connectTls({
          host,
          port,
          servername: isIP(host) ? undefined : host,
          ...transport.tls,
        })
      : connectNet({ host, port });
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    let reported = false;
    socket.once(secure ? 'secureConnect' : 'connect', () => {
      reported = true;
      callback(null, { connection: socket, secured: secure });
    });
    socket.once('error', (error) => {
      if (!reported) {
        reported = true;
        callback(error, {});
      }
    });
  };
  const transporter = nodemailer.createTransport(transport);
  const messageId =
    input.messageId ??
    `<${Date.now()}.${Math.random().toString(16).slice(2)}@vemoki.local>`;
  const timeoutMs = input.timeoutMs ?? 5_000;
  const started = performance.now();
  let timer: NodeJS.Timeout | undefined;

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
        timer = setTimeout(() => {
          for (const socket of sockets) socket.destroy();
          reject(
            Object.assign(new Error('SMTP timeout'), { code: 'ETIMEDOUT' }),
          );
        }, timeoutMs);
      }),
    ]);

    const providerRef =
      typeof info.messageId === 'string' && info.messageId.length > 0
        ? info.messageId
        : messageId;
    const accepted = Array.isArray(info.accepted) && info.accepted.length > 0;
    if (!accepted) throw new SmtpDefiniteRejectError();
    return { providerRef, accepted: true, unknown: false };
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code ?? '')
        : '';
    if (
      code === 'ETIMEDOUT' ||
      code === 'ESOCKET' ||
      /timeout/i.test(String(error))
    ) {
      return { providerRef: messageId, accepted: false, unknown: true };
    }
    const responseCode =
      error && typeof error === 'object' && 'responseCode' in error
        ? Number((error as { responseCode?: unknown }).responseCode)
        : NaN;
    if (
      error instanceof SmtpDefiniteRejectError ||
      (responseCode >= 400 && responseCode < 600) ||
      code === 'EENVELOPE'
    ) {
      throw new SmtpDefiniteRejectError();
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    for (const socket of sockets) socket.destroy();
    metricsObserveSeconds(
      'worker_provider_latency_seconds',
      (performance.now() - started) / 1000,
      { provider: 'smtp' },
    );
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
    throw Object.assign(new Error('SMTP result unknown'), { code: 'ETIMEDOUT' });
  }
  return result.providerRef;
}
