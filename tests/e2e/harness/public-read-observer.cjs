'use strict';

// Loaded only into the local API child with E2E_PUBLIC_READ_DIAGNOSTIC=1.
// Node's HTTP diagnostics channel observes completed responses; it does not
// modify requests, responses, Fastify hooks, or admission decisions.
if (process.env.E2E_PUBLIC_READ_DIAGNOSTIC === '1') {
  const { subscribe } = require('node:diagnostics_channel');
  const { createHash } = require('node:crypto');
  const { readFileSync, writeFileSync } = require('node:fs');

  const output = process.env.E2E_PUBLIC_READ_OUTPUT;
  const phaseFile = process.env.E2E_PUBLIC_READ_PHASE;
  const stopFile = process.env.E2E_PUBLIC_READ_STOP;
  const salt = process.env.E2E_PUBLIC_READ_SALT;
  if (!output || !phaseFile || !stopFile || !salt) {
    throw new Error('E2E public-read observer requires local output, phase, stop and salt');
  }

  const counts = new Map();
  let observed = 0;
  let first429 = false;
  const hash = (value) => createHash('sha256').update(salt).update(value).digest('hex').slice(0, 16);
  const phase = () => {
    try {
      const value = readFileSync(phaseFile, 'utf8').trim();
      return /^(readiness|browser|http|integration)$/.test(value) ? value : 'unknown';
    } catch {
      return 'unknown';
    }
  };
  const route = (path) => {
    if (/^\/v1\/public\/tenants\/[^/]+\/events\/?$/.test(path)) return '/v1/public/tenants/:tenantSlug/events';
    if (/^\/v1\/public\/tenants\/[^/]+\/events\/[^/]+\/?$/.test(path)) return '/v1/public/tenants/:tenantSlug/events/:eventSlug';
    if (/^\/v1\/public\/events\/?$/.test(path)) return '/v1/public/events';
    if (/^\/v1\/public\//.test(path)) return '/v1/public/:other';
    return null;
  };
  const callerHint = (value) => {
    if (typeof value !== 'string') return 'missing';
    if (/^node$/i.test(value)) return 'node';
    if (/^undici(?:\/|$)/i.test(value)) return 'undici';
    if (/^Playwright(?:\/|$)/i.test(value)) return 'playwright';
    if (/^Mozilla\//i.test(value)) return 'browser';
    return 'other';
  };
  const flush = () => writeFileSync(output, JSON.stringify({ observed, first429, counts: [...counts.values()] }), { mode: 0o600 });
  subscribe('http.server.response.finish', ({ request, response }) => {
    try {
      // Strip query in memory. Neither the raw URL nor remote address is persisted.
      const template = route(request.url?.split('?', 1)[0] || '');
      if (!template) return;
      const method = /^(GET|HEAD)$/.test(request.method || '') ? request.method : 'OTHER';
      const status = Number(response.statusCode) || 0;
      const currentPhase = phase();
      const scope = hash(request.socket?.remoteAddress || 'unknown');
      const hint = callerHint(request.headers['user-agent']);
      const key = JSON.stringify([method, template, status, currentPhase, scope, hint]);
      const row = counts.get(key) || { method, route: template, status, phase: currentPhase, transportScopeHash: scope, callerHint: hint, count: 0 };
      row.count++;
      counts.set(key, row);
      observed++;
      if (status === 429 && !first429) {
        first429 = true;
        writeFileSync(stopFile, '429', { mode: 0o600 });
      }
      flush();
    } catch {
      // Observation must never affect an API response.
    }
  });
  process.on('exit', () => { try { flush(); } catch {} });
  flush();
}
