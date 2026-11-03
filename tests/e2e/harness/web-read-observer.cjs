'use strict';

// Loaded only into the local Web (Next.js SSR) child when
// E2E_WEB_READ_DIAGNOSTIC=1. Passive diagnostics-channel observer for the
// child's OUTBOUND undici/fetch requests to the API's public-read routes.
//
// It records the same route-template allowlist as public-read-observer.cjs
// (keep the two `route` implementations in sync) and tags each row with
// `role=web`, so Web SSR/BFF egress can be compared against the API child's
// ingress totals without double counting. It never modifies requests,
// responses, or admission decisions, and it never persists URL, query,
// headers, payloads, IP, or auth.
if (process.env.E2E_WEB_READ_DIAGNOSTIC === '1') {
  const { subscribe } = require('node:diagnostics_channel');
  const { readFileSync, writeFileSync } = require('node:fs');

  const output = process.env.E2E_WEB_READ_OUTPUT;
  const phaseFile = process.env.E2E_WEB_READ_PHASE;
  const role = process.env.E2E_WEB_READ_ROLE || 'web';
  if (!output || !phaseFile) {
    throw new Error('E2E web-read observer requires local output and phase');
  }

  const counts = new Map();
  let observed = 0;
  const phase = () => {
    try {
      const value = readFileSync(phaseFile, 'utf8').trim();
      return /^(readiness|browser|http|integration)$/.test(value)
        ? value
        : 'unknown';
    } catch {
      return 'unknown';
    }
  };
  // Must match public-read-observer.cjs exactly.
  const route = (path) => {
    if (/^\/v1\/public\/tenants\/[^/]+\/events\/?$/.test(path)) return '/v1/public/tenants/:tenantSlug/events';
    if (/^\/v1\/public\/tenants\/[^/]+\/events\/[^/]+\/assets\/[^/]+\/?$/.test(path)) return '/v1/public/tenants/:tenantSlug/events/:eventSlug/assets/:assetId';
    if (/^\/v1\/public\/tenants\/[^/]+\/events\/[^/]+\/?$/.test(path)) return '/v1/public/tenants/:tenantSlug/events/:eventSlug';
    if (/^\/v1\/public\/tenants\/[^/]+\/assets\/[^/]+\/?$/.test(path)) return '/v1/public/tenants/:tenantSlug/assets/:assetId';
    if (/^\/v1\/public\/tenants\/[^/]+\/branding\/?$/.test(path)) return '/v1/public/tenants/:tenantSlug/branding';
    if (/^\/v1\/public\/events\/?$/.test(path)) return '/v1/public/events';
    return null;
  };
  const flush = () =>
    writeFileSync(
      output,
      JSON.stringify({ role, observed, counts: [...counts.values()] }),
      { mode: 0o600 },
    );
  const record = (method, template, status, currentPhase) => {
    const key = JSON.stringify([method, template, status, currentPhase, role]);
    const row = counts.get(key) || {
      method,
      route: template,
      status,
      phase: currentPhase,
      role,
      count: 0,
    };
    row.count++;
    counts.set(key, row);
    observed++;
    flush();
  };
  subscribe('undici:request:headers', ({ request, response }) => {
    try {
      // request.path may include a query string; strip it in memory only.
      const template = route(String(request?.path || '').split('?', 1)[0]);
      if (!template) return;
      const method = /^(GET|HEAD)$/.test(request?.method || '')
        ? request.method
        : 'OTHER';
      const status = Number(response?.statusCode) || 0;
      record(method, template, status, phase());
    } catch {
      // Observation must never affect the Web child's request handling.
    }
  });
  process.on('exit', () => {
    try {
      flush();
    } catch {}
  });
  flush();
}
