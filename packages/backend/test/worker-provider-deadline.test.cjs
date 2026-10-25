const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer: createHttpServer } = require('node:http');
const { createServer: createNetServer } = require('node:net');
const { once } = require('node:events');
const { putObject, sendMimeMailViaSmtp } = require('../dist');

test('stalled MinIO upload is destroyed at its transport deadline', async () => {
  const server = createHttpServer(() => {});
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  const started = performance.now();
  try {
    await assert.rejects(() =>
      putObject(
        {
          endpoint: `http://127.0.0.1:${port}`,
          accessKey: 'fixture',
          secretKey: 'fixture',
          bucket: 'fixture',
          region: 'us-east-1',
        },
        'fixture.csv',
        Buffer.from('a,b\n'),
        'text/csv',
        35,
      ),
    );
    assert.ok(performance.now() - started < 500);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test('MinIO deadline also covers a partial response', async () => {
  const server = createHttpServer((_req, res) => {
    res.writeHead(200);
    res.write('partial');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await assert.rejects(() =>
      putObject(
        {
          endpoint: `http://127.0.0.1:${server.address().port}`,
          accessKey: 'fixture',
          secretKey: 'fixture',
          bucket: 'fixture',
          region: 'us-east-1',
        },
        'fixture.csv',
        Buffer.from('a,b\n'),
        'text/csv',
        35,
      ),
    );
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test('stalled SMTP transport returns UNKNOWN by deadline and closes socket', async () => {
  const sockets = new Set();
  const server = createNetServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.write('220 fixture ESMTP\r\n');
    socket.resume();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  const started = performance.now();
  try {
    const result = await sendMimeMailViaSmtp({
      smtpUrl: `smtp+plain://127.0.0.1:${port}`,
      from: 'fixture@example.test',
      to: 'fixture@example.test',
      subject: 'fixture',
      text: 'fixture',
      html: 'fixture',
      timeoutMs: 35,
    });
    assert.equal(result.unknown, true);
    assert.ok(performance.now() - started < 500);
    await Promise.race([
      Promise.all([...sockets].map((socket) => once(socket, 'close'))),
      new Promise((resolve) => setTimeout(resolve, 250)),
    ]);
    assert.equal(sockets.size, 0, 'deadline must close the provider socket');
  } finally {
    for (const socket of sockets) socket.destroy();
    server.close();
  }
});

test('SMTP accepts MIME through the deadline-owned socket', async () => {
  const server = createNetServer((socket) => {
    socket.write('220 fixture ESMTP\r\n');
    let buffer = '';
    let dataMode = false;
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      if (dataMode) {
        if (buffer.includes('\r\n.\r\n')) {
          buffer = '';
          dataMode = false;
          socket.write('250 queued\r\n');
        }
        return;
      }
      let end;
      while ((end = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (/^EHLO/i.test(line)) socket.write('250 fixture\r\n');
        else if (/^MAIL FROM|^RCPT TO/i.test(line)) socket.write('250 ok\r\n');
        else if (/^DATA/i.test(line)) {
          dataMode = true;
          socket.write('354 send data\r\n');
          break;
        } else if (/^QUIT/i.test(line)) {
          socket.write('221 bye\r\n');
          socket.end();
        }
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const result = await sendMimeMailViaSmtp({
      smtpUrl: `smtp+plain://127.0.0.1:${server.address().port}`,
      from: 'fixture@example.test',
      to: 'fixture@example.test',
      subject: 'fixture',
      text: 'fixture',
      html: '<p>fixture</p>',
      timeoutMs: 500,
    });
    assert.equal(result.unknown, false);
    assert.equal(result.accepted, true);
  } finally {
    server.close();
  }
});
