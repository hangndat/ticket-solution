const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_PRODUCT_WEB_ORIGIN,
  resolveProductWebBaseUrl,
  buildInviteAcceptLink,
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
