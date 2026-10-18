const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_PRODUCT_WEB_ORIGIN,
  resolveProductWebBaseUrl,
  buildInviteAcceptLink,
  buildGuestInvitationClaimLink,
  buildOwnerTicketLink,
  readPublicWebBaseUrl,
} = require('../dist');

test('resolveProductWebBaseUrl rewrites marketing apex to app.vemoki.com', () => {
  assert.equal(
    resolveProductWebBaseUrl('https://vemoki.com'),
    DEFAULT_PRODUCT_WEB_ORIGIN,
  );
  assert.equal(
    resolveProductWebBaseUrl('https://vemoki.com/'),
    DEFAULT_PRODUCT_WEB_ORIGIN,
  );
  assert.equal(
    resolveProductWebBaseUrl('https://www.vemoki.com'),
    DEFAULT_PRODUCT_WEB_ORIGIN,
  );
});

test('resolveProductWebBaseUrl keeps product and custom origins', () => {
  assert.equal(
    resolveProductWebBaseUrl('https://app.vemoki.com/'),
    'https://app.vemoki.com',
  );
  assert.equal(
    resolveProductWebBaseUrl('https://staging.example.com'),
    'https://staging.example.com',
  );
  assert.equal(
    resolveProductWebBaseUrl('http://127.0.0.1:3000/'),
    'http://127.0.0.1:3000',
  );
});

test('buildInviteAcceptLink uses product origin and encodes token', () => {
  assert.equal(
    buildInviteAcceptLink({
      publicWebBaseUrl: 'https://vemoki.com',
      token: 'a+b/c?',
    }),
    `${DEFAULT_PRODUCT_WEB_ORIGIN}/invite?token=${encodeURIComponent('a+b/c?')}`,
  );
  assert.equal(
    buildInviteAcceptLink({
      publicWebBaseUrl: 'https://app.vemoki.com/',
      token: 'tok',
    }),
    'https://app.vemoki.com/invite?token=tok',
  );
});

test('buildGuestInvitationClaimLink puts token in fragment not query', () => {
  const link = buildGuestInvitationClaimLink({
    publicWebBaseUrl: 'https://vemoki.com',
    token: 'tok+1',
    tenantId: '11111111-1111-4111-8111-111111111111',
    eventId: '22222222-2222-4222-8222-222222222222',
    tenantSlug: 'acme',
    eventSlug: 'spring',
  });
  assert.equal(link.includes('?'), false);
  assert.match(link, new RegExp(`^${DEFAULT_PRODUCT_WEB_ORIGIN}/claim#`));
  const hash = link.slice(link.indexOf('#') + 1);
  const params = new URLSearchParams(hash);
  assert.equal(params.get('token'), 'tok+1');
  assert.equal(params.get('tenantId'), '11111111-1111-4111-8111-111111111111');
  assert.equal(params.get('eventId'), '22222222-2222-4222-8222-222222222222');
  assert.equal(params.get('tenantSlug'), 'acme');
  assert.equal(params.get('eventSlug'), 'spring');
});

test('buildOwnerTicketLink encodes path segments and prefers product origin', () => {
  assert.equal(
    buildOwnerTicketLink({
      publicWebBaseUrl: 'https://www.vemoki.com',
      tenantSlug: 'acme/co',
      ticketId: 't id',
    }),
    `${DEFAULT_PRODUCT_WEB_ORIGIN}/t/${encodeURIComponent('acme/co')}/tickets/${encodeURIComponent('t id')}`,
  );
});

test('readPublicWebBaseUrl rewrites apex in env and defaults locally', () => {
  assert.equal(
    readPublicWebBaseUrl({
      PUBLIC_WEB_BASE_URL: 'https://vemoki.com/',
      NODE_ENV: 'development',
    }),
    DEFAULT_PRODUCT_WEB_ORIGIN,
  );
  assert.equal(
    readPublicWebBaseUrl({
      PUBLIC_WEB_BASE_URL: 'https://app.vemoki.com',
      NODE_ENV: 'production',
    }),
    'https://app.vemoki.com',
  );
  assert.equal(
    readPublicWebBaseUrl({ NODE_ENV: 'development' }),
    'http://127.0.0.1:3000',
  );
});
