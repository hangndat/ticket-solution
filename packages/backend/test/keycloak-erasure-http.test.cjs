'use strict';

/**
 * Isolated HTTP fixture for Keycloak Admin erasure mapping (token → GET → DELETE 204).
 * Not a live production Keycloak; proves request paths + auth header + user absence.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const {
  createKeycloakErasureAdapter,
  IDP_ERROR_CODES,
} = require('../dist');

function startFixture() {
  const realm = 'ticket';
  const users = new Map();
  let lastTokenAuth = null;
  let lastDeleteAuth = null;
  let deleteStatus = 204;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (
      req.method === 'POST' &&
      url.pathname ===
        `/realms/${realm}/protocol/openid-connect/token`
    ) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks).toString('utf8');
      const params = new URLSearchParams(body);
      if (
        params.get('grant_type') !== 'client_credentials' ||
        params.get('client_id') !== 'vemoki-erasure' ||
        params.get('client_secret') !== 'test-secret'
      ) {
        res.writeHead(401);
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({ access_token: 'fixture-token', expires_in: 60 }),
      );
      return;
    }

    const userMatch = url.pathname.match(
      new RegExp(`^/admin/realms/${realm}/users/([^/]+)$`),
    );
    if (userMatch) {
      const id = decodeURIComponent(userMatch[1]);
      const auth = req.headers.authorization || '';
      if (req.method === 'GET') {
        lastTokenAuth = auth;
        if (auth !== 'Bearer fixture-token') {
          res.writeHead(401);
          res.end();
          return;
        }
        if (!users.has(id)) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id, enabled: true }));
        return;
      }
      if (req.method === 'DELETE') {
        lastDeleteAuth = auth;
        if (auth !== 'Bearer fixture-token') {
          res.writeHead(401);
          res.end();
          return;
        }
        if (!users.has(id)) {
          res.writeHead(404);
          res.end();
          return;
        }
        users.delete(id);
        res.writeHead(deleteStatus);
        res.end();
        return;
      }
    }

    res.writeHead(404);
    res.end();
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${port}`,
        realm,
        users,
        get lastTokenAuth() {
          return lastTokenAuth;
        },
        get lastDeleteAuth() {
          return lastDeleteAuth;
        },
        setDeleteStatus(code) {
          deleteStatus = code;
        },
      });
    });
  });
}

test(
  'Keycloak HTTP fixture: client_credentials + DELETE 204 + user absence',
  { timeout: 30000 },
  async () => {
    const fx = await startFixture();
    try {
      const subject = randomUUID();
      fx.users.set(subject, true);
      const issuer = 'http://127.0.0.1:8080/realms/ticket';
      const adapter = createKeycloakErasureAdapter({
        baseUrl: fx.baseUrl,
        realm: fx.realm,
        clientId: 'vemoki-erasure',
        clientSecret: 'test-secret',
        allowedIssuers: [issuer],
        enabled: true,
      });

      const deleted = await adapter.deleteUserBySubject({ issuer, subject });
      assert.deepEqual(deleted, { kind: 'DELETED' });
      assert.equal(fx.lastTokenAuth, 'Bearer fixture-token');
      assert.equal(fx.lastDeleteAuth, 'Bearer fixture-token');
      assert.equal(fx.users.has(subject), false);

      const absent = await adapter.deleteUserBySubject({ issuer, subject });
      assert.deepEqual(absent, { kind: 'NOT_FOUND' });
    } finally {
      await new Promise((r) => fx.server.close(r));
    }
  },
);

test(
  'Keycloak HTTP fixture: token path 404 → IDP_PATH_404 (not user absence)',
  { timeout: 15000 },
  async () => {
    const server = http.createServer((req, res) => {
      res.writeHead(404);
      res.end();
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    try {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const issuer = 'http://127.0.0.1:8080/realms/ticket';
      const adapter = createKeycloakErasureAdapter({
        baseUrl: `http://127.0.0.1:${port}`,
        realm: 'ticket',
        clientId: 'vemoki-erasure',
        clientSecret: 'test-secret',
        allowedIssuers: [issuer],
        enabled: true,
      });
      const out = await adapter.deleteUserBySubject({
        issuer,
        subject: randomUUID(),
      });
      assert.equal(out.kind, 'FAILED');
      assert.equal(out.errorCode, IDP_ERROR_CODES.IDP_PATH_404);
    } finally {
      await new Promise((r) => server.close(r));
    }
  },
);
