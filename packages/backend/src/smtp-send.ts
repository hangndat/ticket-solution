import { connect } from 'node:net';

export type SmtpSendInput = {
  smtpUrl: string;
  from: string;
  to: string;
  subject: string;
  body: string;
};

/**
 * Minimal unauthenticated SMTP client for Mailpit / local Postal.
 * Not a full MIME library — sandbox notification only.
 */
export async function sendMailViaSmtp(input: SmtpSendInput): Promise<string> {
  const url = new URL(input.smtpUrl);
  if (url.protocol !== 'smtp:' && url.protocol !== 'smtp+plain:') {
    throw new Error('SMTP_URL must use smtp://');
  }
  const host = url.hostname || '127.0.0.1';
  const port = url.port ? Number(url.port) : 25;
  const messageId = `<${Date.now()}.${Math.random().toString(16).slice(2)}@localhost>`;

  await withSmtpSession(host, port, async (send) => {
    await send(`EHLO localhost`);
    await send(`MAIL FROM:<${sanitizeAddr(input.from)}>`);
    await send(`RCPT TO:<${sanitizeAddr(input.to)}>`);
    await send(`DATA`);
    const data = [
      `From: ${input.from}`,
      `To: ${input.to}`,
      `Subject: ${input.subject.replace(/[\r\n]/g, ' ')}`,
      `Message-ID: ${messageId}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=utf-8`,
      '',
      input.body.replace(/^\./gm, '..'),
      '.',
    ].join('\r\n');
    await send(data, true);
    await send(`QUIT`);
  });

  return messageId;
}

function sanitizeAddr(value: string): string {
  return value.replace(/[<>\r\n]/g, '');
}

async function withSmtpSession(
  host: string,
  port: number,
  run: (send: (line: string, raw?: boolean) => Promise<string>) => Promise<void>,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = connect({ host, port });
    let buffer = '';
    let pending: {
      resolve: (v: string) => void;
      reject: (e: Error) => void;
    } | null = null;

    const fail = (error: Error) => {
      if (pending) pending.reject(error);
      pending = null;
      socket.destroy();
      reject(error);
    };

    const readResponse = (): Promise<string> =>
      new Promise((res, rej) => {
        pending = { resolve: res, reject: rej };
        flush();
      });

    const flush = () => {
      if (!pending) return;
      const lines = buffer.split(/\r?\n/);
      // Keep incomplete trailing chunk in buffer.
      buffer = lines.pop() ?? '';
      let i = 0;
      while (i < lines.length) {
        const line = lines[i] ?? '';
        const code = line.slice(0, 3);
        const cont = line[3] === '-';
        if (!/^\d{3}$/.test(code)) {
          i += 1;
          continue;
        }
        if (cont) {
          i += 1;
          continue;
        }
        const block = lines.slice(0, i + 1).join('\n');
        lines.splice(0, i + 1);
        buffer = lines.join('\n') + (buffer ? '\n' + buffer : '');
        const waiter = pending;
        pending = null;
        const num = Number(code);
        if (num >= 400) waiter?.reject(new Error(`SMTP ${block}`));
        else waiter?.resolve(block);
        return;
      }
    };

    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      flush();
    });
    socket.on('error', fail);
    socket.on('close', () => {
      if (pending) fail(new Error('SMTP connection closed'));
    });

    const send = async (line: string, raw = false): Promise<string> => {
      const payload = raw ? `${line}\r\n` : `${line}\r\n`;
      socket.write(payload);
      return readResponse();
    };

    readResponse()
      .then(() => run(send))
      .then(() => {
        socket.end();
        resolve();
      })
      .catch(fail);
  });
}
