const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp, createOpenApi, readApiEnvironment } = require('../dist/app');
test('Fastify liveness matches contract; redeem and gate routes documented', async () => {
  const app = await createApp(false);
  try {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const response = await app.inject({ method: 'GET', url: '/v1/health' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      status: 'ok',
      service: 'api',
      version: '0.1.0',
    });
    assert.equal(
      (await app.inject({ method: 'GET', url: '/v1/events' })).statusCode,
      404,
    );
    const doc = createOpenApi(app);
    assert.deepEqual(Object.keys(doc.paths).sort(), [
      '/v1/gate/events/{eventId}/checkins/{checkinId}/undo',
      '/v1/gate/events/{eventId}/offline-sync',
      '/v1/gate/events/{eventId}/reservations',
      '/v1/gate/events/{eventId}/reservations/{reservationId}/confirm',
      '/v1/gate/events/{eventId}/sessions',
      '/v1/gate/events/{eventId}/sessions/revoke',
      '/v1/gate/events/{eventId}/tickets/{ticketId}/revoke',
      '/v1/health',
      '/v1/me',
      '/v1/me/account-deletion-requests',
      '/v1/me/account-deletion-requests/current',
      '/v1/me/device-tokens',
      '/v1/me/device-tokens/{registrationId}',
      '/v1/me/events',
      '/v1/me/membership-invites/accept',
      '/v1/me/redemptions/{requestId}',
      '/v1/me/tenants',
      '/v1/me/tickets',
      '/v1/me/tickets/{ticketId}',
      '/v1/operations/{clientOperationId}',
      '/v1/platform/audit',
      '/v1/platform/me',
      '/v1/platform/support-grants',
      '/v1/platform/support-grants/{grantId}/tickets',
      '/v1/platform/tenants',
      '/v1/platform/tenants/{tenantId}',
      '/v1/platform/tenants/{tenantId}/limits',
      '/v1/platform/tenants/{tenantId}/status',
      '/v1/public/tenants/{tenantSlug}/events',
      '/v1/public/tenants/{tenantSlug}/events/{eventSlug}',
      '/v1/tenants/{tenantId}/branding',
      '/v1/tenants/{tenantId}/events',
      '/v1/tenants/{tenantId}/events/{eventId}',
      '/v1/tenants/{tenantId}/events/{eventId}/archive',
      '/v1/tenants/{tenantId}/events/{eventId}/assets/finalize',
      '/v1/tenants/{tenantId}/events/{eventId}/assets/upload-init',
      '/v1/tenants/{tenantId}/events/{eventId}/audit',
      '/v1/tenants/{tenantId}/events/{eventId}/cancel',
      '/v1/tenants/{tenantId}/events/{eventId}/clone',
      '/v1/tenants/{tenantId}/events/{eventId}/codes',
      '/v1/tenants/{tenantId}/events/{eventId}/config-versions',
      '/v1/tenants/{tenantId}/events/{eventId}/config-versions/{version}/preview',
      '/v1/tenants/{tenantId}/events/{eventId}/config/rollback',
      '/v1/tenants/{tenantId}/events/{eventId}/exports',
      '/v1/tenants/{tenantId}/events/{eventId}/exports/{exportId}',
      '/v1/tenants/{tenantId}/events/{eventId}/exports/{exportId}/download',
      '/v1/tenants/{tenantId}/events/{eventId}/impact-preview',
      '/v1/tenants/{tenantId}/events/{eventId}/imports',
      '/v1/tenants/{tenantId}/events/{eventId}/imports/files',
      '/v1/tenants/{tenantId}/events/{eventId}/imports/{importId}',
      '/v1/tenants/{tenantId}/events/{eventId}/imports/{importId}/commit',
      '/v1/tenants/{tenantId}/events/{eventId}/imports/{importId}/errors',
      '/v1/tenants/{tenantId}/events/{eventId}/imports/{importId}/preview',
      '/v1/tenants/{tenantId}/events/{eventId}/invitations',
      '/v1/tenants/{tenantId}/events/{eventId}/invitations/claim',
      '/v1/tenants/{tenantId}/events/{eventId}/invitations/dispatch',
      '/v1/tenants/{tenantId}/events/{eventId}/invitations/dispatch-preview',
      '/v1/tenants/{tenantId}/events/{eventId}/notification-templates/preview',
      '/v1/tenants/{tenantId}/events/{eventId}/notification-templates/publish',
      '/v1/tenants/{tenantId}/events/{eventId}/notifications',
      '/v1/tenants/{tenantId}/events/{eventId}/notifications/{notificationId}/retry',
      '/v1/tenants/{tenantId}/events/{eventId}/publish',
      '/v1/tenants/{tenantId}/events/{eventId}/quota',
      '/v1/tenants/{tenantId}/events/{eventId}/redemptions',
      '/v1/tenants/{tenantId}/events/{eventId}/redemptions/{requestId}/approve',
      '/v1/tenants/{tenantId}/events/{eventId}/redemptions/{requestId}/deny',
      '/v1/tenants/{tenantId}/events/{eventId}/report',
      '/v1/tenants/{tenantId}/events/{eventId}/sources',
      '/v1/tenants/{tenantId}/events/{eventId}/ticket-types',
      '/v1/tenants/{tenantId}/events/{eventId}/tickets',
      '/v1/tenants/{tenantId}/events/{eventId}/tickets/{ticketId}',
      '/v1/tenants/{tenantId}/events/{eventId}/tickets/{ticketId}/resend',
      '/v1/tenants/{tenantId}/invites',
      '/v1/tenants/{tenantId}/invites/{inviteId}/resend',
      '/v1/tenants/{tenantId}/invites/{inviteId}/revoke',
      '/v1/tenants/{tenantId}/members',
      '/v1/tenants/{tenantId}/members/{membershipId}/event-assignments/{eventId}',
      '/v1/tenants/{tenantId}/members/{membershipId}/revoke',
      '/v1/tenants/{tenantId}/members/{membershipId}/role',
    ]);
    // /metrics is Fastify-native outside OpenAPI /v1 prefix.
    assert.equal(
      doc.components.schemas.HealthDto.properties.status.enum[0],
      'ok',
    );
  } finally {
    await app.close();
  }
});
test('invalid environment fails with no secret reflection', () => {
  for (const PORT of ['0', '65536', '3e3', 'secret'])
    assert.throws(() => readApiEnvironment({ PORT }));
  assert.throws(() => readApiEnvironment({ NODE_ENV: 'preview' }));
  assert.equal(readApiEnvironment({}).port, 3001);
});

test('listening Fastify API closes cleanly', async () => {
  const app = await createApp(false);
  try {
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpAdapter().getInstance().server.address();
    const response = await fetch(
      'http://127.0.0.1:' + address.port + '/v1/health',
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).service, 'api');
  } finally {
    await app.close();
  }
  assert.equal(app.getHttpAdapter().getInstance().server.listening, false);
});
