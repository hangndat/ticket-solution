'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../dist/app');
const { IDENTITY_ERROR_CODES } = require('@ticket/backend');

const tenantId = '00000000-0000-4000-8000-000000000002';
const eventId = '00000000-0000-4000-8000-000000000001';

// All four catalog endpoints that moved from EventAdminService to
// EventCatalogService. POST routes carry a minimal valid body so the request
// reaches the controller (body shape is not validated without a pipe).
const catalogRoutes = [
  {
    method: 'GET',
    url: `/v1/tenants/${tenantId}/events/${eventId}/ticket-types`,
  },
  {
    method: 'POST',
    url: `/v1/tenants/${tenantId}/events/${eventId}/ticket-types`,
    payload: { label: 'VIP' },
  },
  {
    method: 'GET',
    url: `/v1/tenants/${tenantId}/events/${eventId}/sources`,
  },
  {
    method: 'POST',
    url: `/v1/tenants/${tenantId}/events/${eventId}/sources`,
    payload: {
      name: 'Web',
      approvalMode: 'AUTO',
      ticketTypeId: eventId,
    },
  },
];

function inject(app, route, url) {
  return route.payload === undefined
    ? app.inject({ method: route.method, url })
    : app.inject({ method: route.method, url, payload: route.payload });
}

test('event catalog routes validate tenant and event UUIDs before identity', async () => {
  const app = await createApp(false);
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    for (const route of catalogRoutes) {
      const badTenant = route.url.replace(tenantId, 'not-a-uuid');
      const tenantRes = await inject(app, route, badTenant);
      assert.equal(
        tenantRes.statusCode,
        422,
        `${route.method} ${route.url} bad tenant`,
      );
      assert.equal(tenantRes.json().code, 'SCOPE_REQUIRED');

      const badEvent = route.url.replace(eventId, 'not-a-uuid');
      const eventRes = await inject(app, route, badEvent);
      assert.equal(
        eventRes.statusCode,
        422,
        `${route.method} ${route.url} bad event`,
      );
      assert.equal(eventRes.json().code, 'SCOPE_REQUIRED');
    }
  } finally {
    await app.close();
  }
});

test('event catalog routes fail closed on identity config before tenant data', async () => {
  const app = await createApp(false);
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    for (const route of catalogRoutes) {
      const res = await inject(app, route, route.url);
      // Wired (not 404) and fail-closed at the OIDC boundary, never touching
      // a database or tenant row.
      assert.equal(res.statusCode, 503, `${route.method} ${route.url}`);
      assert.equal(res.json().code, IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED);
    }
  } finally {
    await app.close();
  }
});
