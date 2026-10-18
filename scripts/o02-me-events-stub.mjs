#!/usr/bin/env node
/**
 * Local stub for O02 iOS dual-persona sim-uat (chrome only).
 * Not production. Tokens: "staff-uat-token" / "attendee-uat-token".
 */
import http from 'node:http';

const PORT = Number(process.env.O02_STUB_PORT || 4370);

function readBearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1]?.trim() || '';
}

function json(res, status, body) {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(raw),
  });
  res.end(raw);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  const path = url.pathname.replace(/\/$/, '') || '/';
  const token = readBearer(req);

  if (req.method === 'GET' && path === '/v1/health') {
    return json(res, 200, { status: 'ok', stub: 'o02-me-events' });
  }

  if (req.method === 'GET' && path === '/v1/me') {
    if (!token) return json(res, 401, { code: 'UNAUTHENTICATED' });
    if (token.startsWith('staff')) {
      return json(res, 200, {
        userId: 'usr-o02-staff',
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'o02-staff',
        email: 'staff@example.com',
        emailVerified: true,
      });
    }
    if (token.startsWith('attendee')) {
      return json(res, 200, {
        userId: 'usr-o02-attendee',
        issuer: 'http://127.0.0.1:8080/realms/ticket',
        subject: 'o02-attendee',
        email: 'attendee@example.com',
        emailVerified: true,
      });
    }
    return json(res, 401, { code: 'UNAUTHENTICATED' });
  }

  if (req.method === 'GET' && path === '/v1/me/events') {
    if (!token) return json(res, 401, { code: 'UNAUTHENTICATED' });
    if (token.startsWith('staff')) {
      return json(res, 200, {
        staffEligible: true,
        items: [
          {
            tenantId: '11111111-1111-1111-1111-111111111111',
            eventId: '22222222-2222-2222-2222-222222222222',
            name: 'O02 Stub Event',
            permissions: ['gate.confirm'],
          },
        ],
      });
    }
    return json(res, 200, { staffEligible: false, items: [] });
  }

  json(res, 404, { code: 'NOT_FOUND' });
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`o02-me-events-stub listening on http://127.0.0.1:${PORT}\n`);
});
