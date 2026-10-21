import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SessionBoundary,
  type CredentialStore,
  type SessionEpoch,
} from '../identity/session-boundary.ts';
import { DEFAULT_NOTIFICATION_ACTION } from './notification-contract.ts';
import {
  __resetNotificationIntentForTests,
  peekNotificationTapIntent,
} from './notification-intent.ts';
import {
  handleNotificationResponse,
  startNotificationResponseHandling,
  type NotificationResponseLike,
  type NotificationResponseTransport,
} from './notification-response.ts';

const TICKET = '11111111-1111-4111-8111-111111111111';
const EVENT = '22222222-2222-4222-8222-222222222222';
const TENANT = '33333333-3333-4333-8333-333333333333';
const OTHER = '44444444-4444-4444-8444-444444444444';

function memoryStore(initial: string | null = null): CredentialStore {
  let value = initial;
  return {
    async read() {
      return value;
    },
    async write(credential: string) {
      value = credential;
    },
    async clear() {
      value = null;
    },
  };
}

async function verifiedSession(userId = 'user-a'): Promise<SessionBoundary> {
  const boundary = new SessionBoundary(memoryStore());
  await boundary.establish('bearer-token', async () => ({ userId }));
  return boundary;
}

function tapResponse(
  data: Record<string, unknown>,
  identifier = 'notif-1',
  date = 1_700_000_000_000,
): NotificationResponseLike {
  return {
    actionIdentifier: DEFAULT_NOTIFICATION_ACTION,
    notification: {
      date,
      request: {
        identifier,
        content: { data },
      },
    },
  };
}

test('signed-out tap parks intent; login resolve navigates once', async () => {
  __resetNotificationIntentForTests();
  const session = new SessionBoundary(memoryStore());
  const navigated: string[] = [];

  const parked = await handleNotificationResponse(
    tapResponse({
      kind: 'TicketIssued',
      payloadVersion: 1,
      ticketId: TICKET,
      tenantId: TENANT,
    }),
    {
      session,
      navigate: (href) => navigated.push(href),
      probeTickets: async () => ({
        status: 'ok',
        body: {
          tickets: [
            {
              ticketId: TICKET,
              tenantId: TENANT,
              eventId: EVENT,
              ticketTypeId: 'tt',
              sourceId: 'src',
              state: 'ACTIVE',
              credentialVersion: 1,
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      }),
    },
  );
  assert.equal(parked.status, 'parked');
  assert.ok(peekNotificationTapIntent());
  assert.equal(navigated.length, 0);

  await session.establish('bearer-token', async () => ({ userId: 'user-a' }));
  // Resume path via handle again would duplicate — resolve via second tap of
  // a *new* response after login, and ensure prior park is superseded.
  const second = await handleNotificationResponse(
    tapResponse(
      {
        kind: 'TicketIssued',
        payloadVersion: 1,
        ticketId: TICKET,
        tenantId: TENANT,
      },
      'notif-2',
      1_700_000_000_001,
    ),
    {
      session,
      navigate: (href) => {
        navigated.push(href);
      },
      probeTickets: async () => ({
        status: 'ok',
        body: {
          tickets: [
            {
              ticketId: TICKET,
              tenantId: TENANT,
              eventId: EVENT,
              ticketTypeId: 'tt',
              sourceId: 'src',
              state: 'ACTIVE',
              credentialVersion: 1,
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      }),
    },
  );
  assert.equal(second.status, 'navigated');
  if (second.status === 'navigated') {
    assert.equal(second.href, `/my-tickets/${TICKET}`);
  }
  assert.deepEqual(navigated, [`/my-tickets/${TICKET}`]);
});

test('foreign ticket and invalid payload are safe (no navigate)', async () => {
  __resetNotificationIntentForTests();
  const session = await verifiedSession();
  const navigated: string[] = [];

  const foreign = await handleNotificationResponse(
    tapResponse({
      kind: 'TicketIssued',
      payloadVersion: 1,
      ticketId: OTHER,
      tenantId: TENANT,
    }),
    {
      session,
      navigate: (href) => navigated.push(href),
      probeTickets: async () => ({
        status: 'ok',
        body: {
          tickets: [
            {
              ticketId: TICKET,
              tenantId: TENANT,
              eventId: EVENT,
              ticketTypeId: 'tt',
              sourceId: 'src',
              state: 'ACTIVE',
              credentialVersion: 1,
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      }),
    },
  );
  assert.equal(foreign.status, 'denied');
  assert.equal(navigated.length, 0);

  const invalid = await handleNotificationResponse(
    tapResponse({ kind: 'TicketIssued', payloadVersion: 1 }, 'bad', 2),
    {
      session,
      navigate: (href) => {
        navigated.push(href);
      },
    },
  );
  assert.equal(invalid.status, 'invalid');
  assert.equal(navigated.length, 0);
});

test('multiple taps of the same response navigate once', async () => {
  __resetNotificationIntentForTests();
  const session = await verifiedSession();
  const navigated: string[] = [];
  const response = tapResponse({
    kind: 'TicketIssued',
    payloadVersion: 1,
    ticketId: TICKET,
    tenantId: TENANT,
  });
  const probeTickets = async () => ({
    status: 'ok' as const,
    body: {
      tickets: [
        {
          ticketId: TICKET,
          tenantId: TENANT,
          eventId: EVENT,
          ticketTypeId: 'tt',
          sourceId: 'src',
          state: 'ACTIVE',
          credentialVersion: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    },
  });
  const deps = {
    session,
    navigate: (href: string) => {
      navigated.push(href);
    },
    probeTickets,
  };

  const first = await handleNotificationResponse(response, deps);
  const second = await handleNotificationResponse(response, deps);
  assert.equal(first.status, 'navigated');
  assert.equal(second.status, 'duplicate');
  assert.deepEqual(navigated, [`/my-tickets/${TICKET}`]);
});

test('logout/switch before late resolve does not navigate prior intent', async () => {
  __resetNotificationIntentForTests();
  const session = await verifiedSession('user-a');
  const navigated: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });

  const pending = handleNotificationResponse(
    tapResponse({
      kind: 'TicketIssued',
      payloadVersion: 1,
      ticketId: TICKET,
      tenantId: TENANT,
    }),
    {
      session,
      navigate: (href) => navigated.push(href),
      probeTickets: async () => {
        await gate;
        return {
          status: 'ok',
          body: {
            tickets: [
              {
                ticketId: TICKET,
                tenantId: TENANT,
                eventId: EVENT,
                ticketTypeId: 'tt',
                sourceId: 'src',
                state: 'ACTIVE',
                credentialVersion: 1,
                createdAt: '2026-01-01T00:00:00.000Z',
              },
            ],
          },
        };
      },
    },
  );

  await session.logout();
  release();
  const result = await pending;
  assert.equal(result.status, 'stale');
  assert.deepEqual(navigated, []);
});

test('event tap uses published route — never fixture path', async () => {
  __resetNotificationIntentForTests();
  const session = await verifiedSession();
  const navigated: string[] = [];

  const result = await handleNotificationResponse(
    tapResponse({
      kind: 'EventChanged',
      payloadVersion: 1,
      eventId: EVENT,
      tenantSlug: 'acme',
      eventSlug: 'spring-fest',
    }),
    {
      session,
      navigate: (href) => navigated.push(href),
      fetchPublished: async () => ({
        status: 'ok',
        event: {
          id: EVENT,
          tenantId: '22222222-2222-4222-8222-222222222222',
          tenantSlug: 'acme',
          slug: 'spring-fest',
          name: 'Spring',
          timezone: 'UTC',
          startsAt: null,
          location: null,
          publishedConfigVersion: 1,
          schemaVersion: 1,
          sections: [],
          faq: [],
          terms: null,
          brand: { primaryColor: '#000', organizationName: 'Acme' },
        },
      }),
    },
  );
  assert.equal(result.status, 'navigated');
  assert.deepEqual(navigated, ['/events/acme/spring-fest']);
  assert.equal(navigated[0]?.includes('fixture'), false);
});

test('injected transport cold+warm: last response consumed once', async () => {
  __resetNotificationIntentForTests();
  const session = await verifiedSession();
  const navigated: string[] = [];
  const response = tapResponse({
    kind: 'TicketIssued',
    payloadVersion: 1,
    ticketId: TICKET,
    tenantId: TENANT,
  });
  const listeners: ((r: NotificationResponseLike) => void)[] = [];
  let cleared = 0;
  const transport: NotificationResponseTransport = {
    async getLastNotificationResponseAsync() {
      return response;
    },
    addNotificationResponseReceivedListener(cb) {
      listeners.push(cb);
      return {
        remove() {
          const idx = listeners.indexOf(cb);
          if (idx >= 0) listeners.splice(idx, 1);
        },
      };
    },
    async clearLastNotificationResponseAsync() {
      cleared += 1;
    },
  };

  const controller = startNotificationResponseHandling(transport, {
    session,
    navigate: (href) => navigated.push(href),
    probeTickets: async () => ({
      status: 'ok',
      body: {
        tickets: [
          {
            ticketId: TICKET,
            tenantId: TENANT,
            eventId: EVENT,
            ticketTypeId: 'tt',
            sourceId: 'src',
            state: 'ACTIVE',
            credentialVersion: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    }),
  });

  const cold = await controller.consumeLast();
  assert.equal(cold?.status, 'navigated');
  for (const cb of listeners) cb(response);
  // Allow warm microtask to settle.
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(navigated, [`/my-tickets/${TICKET}`]);
  assert.ok(cleared >= 1);
  controller.stop();
});

test('epoch capture still present so wallet path is independent of push deny', async () => {
  __resetNotificationIntentForTests();
  const session = await verifiedSession();
  const epoch: SessionEpoch | null = session.captureEpoch();
  assert.ok(epoch);
  const denied = await handleNotificationResponse(
    tapResponse({
      kind: 'TicketIssued',
      payloadVersion: 1,
      ticketId: OTHER,
      tenantId: TENANT,
    }),
    {
      session,
      navigate: () => {
        throw new Error('must not navigate');
      },
      probeTickets: async () => ({ status: 'unauthorized' }),
    },
  );
  assert.equal(denied.status, 'denied');
  // Session remains verified — push deny must not clear wallet identity.
  assert.equal(session.getSnapshot().status, 'verified');
  assert.equal(session.isEpochCurrent(epoch), true);
});
