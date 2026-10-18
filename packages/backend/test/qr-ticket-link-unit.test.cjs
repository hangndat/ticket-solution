const { test } = require('node:test');
const assert = require('node:assert/strict');
// Prefer thin module — avoids pulling Prisma/contracts via dist/index.
const { buildOwnerTicketLink } = require('../dist/web-links');

/**
 * Contract lock for TicketIssued email `{{ticketLink}}`.
 * Path must stay `/t/{tenantSlug}/tickets/{ticketId}` (see
 * docs/reviews/D13-BUG-BE-TICKET-LINK-AUDIT.md). Implementation lives in
 * `web-links.ts` after O13 product-origin cutover (#395).
 */
test('buildOwnerTicketLink locks /t/{tenant}/tickets/{id} contract', () => {
  const href = buildOwnerTicketLink({
    publicWebBaseUrl: 'https://vemoki.example/',
    tenantSlug: 'demo-fun',
    ticketId: '11111111-1111-4111-8111-111111111111',
  });
  assert.equal(
    href,
    'https://vemoki.example/t/demo-fun/tickets/11111111-1111-4111-8111-111111111111',
  );
  assert.match(href, /\/t\/[^/?#]+\/tickets\/[^/?#]+$/);
  assert.equal(href.includes('?'), false);
  assert.equal(href.includes('#'), false);
  assert.equal(href.includes('token'), false);
});

test('buildOwnerTicketLink encodes slug/id and strips trailing base slash', () => {
  const href = buildOwnerTicketLink({
    publicWebBaseUrl: 'https://app.example/base///',
    tenantSlug: 'ten ant/x',
    ticketId: 'id with/space',
  });
  assert.equal(
    href,
    'https://app.example/base/t/ten%20ant%2Fx/tickets/id%20with%2Fspace',
  );
});
