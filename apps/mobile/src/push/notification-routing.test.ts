import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SessionBoundary,
  type CredentialStore,
} from '../identity/session-boundary.ts';
import { DEFAULT_NOTIFICATION_ACTION } from './notification-contract.ts';
import {
  __resetNotificationIntentForTests,
  peekNotificationTapIntent,
} from './notification-intent.ts';
import { attachNotificationRouting } from './notification-routing.ts';
import type {
  NotificationResponseLike,
  NotificationResponseTransport,
} from './notification-response.ts';

const TICKET = '11111111-1111-4111-8111-111111111111';
const EVENT = '22222222-2222-4222-8222-222222222222';
const TENANT = '33333333-3333-4333-8333-333333333333';

function memoryStore(): CredentialStore {
  let value: string | null = null;
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

function tapResponse(
  data: Record<string, unknown>,
): NotificationResponseLike {
  return {
    actionIdentifier: DEFAULT_NOTIFICATION_ACTION,
    notification: {
      date: 1,
      request: {
        identifier: 'cold-1',
        content: { data },
      },
    },
  };
}

test('signed-out cold tap then login resumes one published ticket route', async () => {
  __resetNotificationIntentForTests();
  const session = new SessionBoundary(memoryStore());
  const navigated: string[] = [];
  const response = tapResponse({
    kind: 'TicketIssued',
    payloadVersion: 1,
    ticketId: TICKET,
    tenantId: TENANT,
  });

  const transport: NotificationResponseTransport = {
    async getLastNotificationResponseAsync() {
      return response;
    },
    addNotificationResponseReceivedListener() {
      return { remove() {} };
    },
    async clearLastNotificationResponseAsync() {},
  };

  const handle = await attachNotificationRouting({
    session,
    navigate: (href) => navigated.push(href),
    transport,
    resolveExtras: {
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
  });

  // Allow cold consumeLast to park while unsigned.
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(peekNotificationTapIntent());
  assert.deepEqual(navigated, []);

  await session.establish('bearer', async () => ({ userId: 'user-a' }));
  // subscribe is async void — flush.
  await new Promise((r) => setTimeout(r, 0));
  await handle.onSessionChanged();

  assert.deepEqual(navigated, [`/my-tickets/${TICKET}`]);
  assert.equal(peekNotificationTapIntent(), null);
  handle.stop();
});

test('clear on signed-out drops pending push intent', async () => {
  __resetNotificationIntentForTests();
  const session = new SessionBoundary(memoryStore());
  await session.establish('bearer', async () => ({ userId: 'user-a' }));

  const handle = await attachNotificationRouting({
    session,
    navigate: () => {},
    transport: {
      async getLastNotificationResponseAsync() {
        return null;
      },
      addNotificationResponseReceivedListener() {
        return { remove() {} };
      },
    },
  });

  const { parkNotificationTapIntent } = await import(
    './notification-intent.ts'
  );
  parkNotificationTapIntent({
    responseId: 'r',
    kind: 'TicketIssued',
    payloadVersion: 1,
    ticketId: TICKET,
    parkedUserId: 'user-a',
    parkedGeneration: session.captureEpoch()!.generation,
  });

  await session.logout();
  await new Promise((r) => setTimeout(r, 0));
  await handle.onSessionChanged();
  assert.equal(peekNotificationTapIntent(), null);
  handle.stop();
});
