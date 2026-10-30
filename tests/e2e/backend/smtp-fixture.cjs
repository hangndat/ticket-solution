'use strict';

const { createServer: createNetServer } = require('node:net');
const { once } = require('node:events');

/** Accepts greeting then stalls (worker SMTP timeout → UNKNOWN). */
async function startStalledSmtp() {
  const server = createNetServer((socket) => {
    socket.write('220 job03-stall ESMTP\r\n');
    socket.resume();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  return {
    smtpUrl: `smtp+plain://127.0.0.1:${port}`,
    close() {
      server.closeAllConnections?.();
      server.close();
    },
  };
}

/** Minimal ESMTP that rejects RCPT (transport failure, no delivery). */
async function startRejectingSmtp() {
  let recipientAttempts = 0;
  const server = createNetServer((socket) => {
    socket.write('220 job03-reject ESMTP\r\n');
    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      let end;
      while ((end = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (/^EHLO/i.test(line)) socket.write('250 job03-reject\r\n');
        else if (/^MAIL FROM/i.test(line)) socket.write('250 ok\r\n');
        else if (/^RCPT TO/i.test(line)) {
          recipientAttempts += 1;
          socket.write('550 mailbox unavailable\r\n');
        }
        else if (/^RSET/i.test(line)) socket.write('250 reset\r\n');
        else if (/^QUIT/i.test(line)) {
          socket.write('221 bye\r\n');
          socket.end();
        }
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  return {
    smtpUrl: `smtp+plain://127.0.0.1:${port}`,
    get recipientAttempts() { return recipientAttempts; },
    close() {
      server.closeAllConnections?.();
      server.close();
    },
  };
}

module.exports = { startStalledSmtp, startRejectingSmtp };
