import assert from 'node:assert/strict';
import { test } from 'node:test';

type LoadOwner = {
  ownerUserId: string;
  ownerTenantId: string;
  ticketId: string;
  mode: 'verified' | 'offline-display';
};

type LoadState =
  | { status: 'idle' }
  | (LoadOwner & {
      status: 'ready';
      ticketId: string;
    })
  | (LoadOwner & { status: 'missing' });

function loadMatchesOwner(
  load: LoadState,
  owner: LoadOwner | null,
): boolean {
  if (!owner || (load.status !== 'ready' && load.status !== 'missing')) {
    return false;
  }
  return (
    load.ownerUserId === owner.ownerUserId &&
    load.ownerTenantId === owner.ownerTenantId &&
    load.ticketId === owner.ticketId &&
    load.mode === owner.mode
  );
}

test('ticket detail refuses ready state from previous owner on account switch', () => {
  const stale: LoadState = {
    status: 'ready',
    ownerUserId: 'user-a',
    ownerTenantId: 'tenant-1',
    ticketId: 'ticket-1',
    mode: 'verified',
  };
  const ownerB: LoadOwner = {
    ownerUserId: 'user-b',
    ownerTenantId: 'tenant-1',
    ticketId: 'ticket-1',
    mode: 'verified',
  };
  assert.equal(loadMatchesOwner(stale, ownerB), false);
  const visible = loadMatchesOwner(stale, ownerB) ? stale : { status: 'idle' };
  assert.equal(visible.status, 'idle');
});

test('ticket detail accepts ready state only for matching owner/mode/ticket', () => {
  const ready: LoadState = {
    status: 'ready',
    ownerUserId: 'user-a',
    ownerTenantId: 'tenant-1',
    ticketId: 'ticket-1',
    mode: 'offline-display',
  };
  assert.equal(
    loadMatchesOwner(ready, {
      ownerUserId: 'user-a',
      ownerTenantId: 'tenant-1',
      ticketId: 'ticket-1',
      mode: 'offline-display',
    }),
    true,
  );
  assert.equal(
    loadMatchesOwner(ready, {
      ownerUserId: 'user-a',
      ownerTenantId: 'tenant-1',
      ticketId: 'ticket-1',
      mode: 'verified',
    }),
    false,
  );
});
