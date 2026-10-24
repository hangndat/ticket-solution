import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CREDENTIAL_UNREACHABLE,
  SessionBoundary,
  type CredentialStore,
} from './session-boundary.ts';
import { tryRestoreVerifiedSession } from './session-restore-retry.ts';

function fixture(initial: string | null) {
  let credential = initial;
  const store: CredentialStore = {
    read: async () => credential,
    write: async (next) => {
      credential = next;
    },
    clear: async () => {
      credential = null;
    },
  };
  return {
    boundary: new SessionBoundary(store),
    credential: () => credential,
    store,
  };
}

test('tryRestoreVerifiedSession skips restore when already verified', async () => {
  const f = fixture('tok');
  await f.boundary.establish('tok', async () => ({ userId: 'staff-1' }));
  const outcome = await tryRestoreVerifiedSession(f.boundary);
  assert.equal(outcome, 'already-verified');
  assert.equal(f.boundary.getSnapshot().status, 'verified');
});

test('tryRestoreVerifiedSession elevates only after server verify', async () => {
  const f = fixture('stored-bearer');
  const outcome = await tryRestoreVerifiedSession(
    f.boundary,
    async (credential) => ({ userId: credential }),
  );
  assert.equal(outcome, 'verified');
  const snap = f.boundary.getSnapshot();
  assert.equal(snap.status, 'verified');
  if (snap.status === 'verified') {
    assert.equal(snap.userId, 'stored-bearer');
  }
});

test('tryRestoreVerifiedSession stays signed-out without credential', async () => {
  const f = fixture(null);
  const outcome = await tryRestoreVerifiedSession(f.boundary, async () => ({
    userId: 'should-not-run',
  }));
  assert.equal(outcome, 'signed-out');
  assert.equal(f.boundary.getSnapshot().status, 'signed-out');
});

test('tryRestoreVerifiedSession mirrors restore when /v1/me is unreachable', async () => {
  const f = fixture('keychain-token');
  const expected = await f.boundary.restore(async () => CREDENTIAL_UNREACHABLE);
  const f2 = fixture('keychain-token');
  const outcome = await tryRestoreVerifiedSession(
    f2.boundary,
    async () => CREDENTIAL_UNREACHABLE,
  );
  assert.equal(outcome, expected);
  assert.equal(f2.boundary.getSnapshot().status, 'signed-out');
  assert.equal(f2.credential(), 'keychain-token');
});

test('tryRestoreVerifiedSession restores user B credential after logout', async () => {
  const f = fixture('user-a-token');
  await f.boundary.establish('user-a-token', async () => ({ userId: 'user-a' }));
  await f.boundary.logout();
  await f.store.write('user-b-token');
  const outcome = await tryRestoreVerifiedSession(
    f.boundary,
    async (credential) =>
      credential === 'user-b-token' ? { userId: 'user-b' } : null,
  );
  assert.equal(outcome, 'verified');
  const snap = f.boundary.getSnapshot();
  assert.equal(snap.status, 'verified');
  if (snap.status === 'verified') {
    assert.equal(snap.userId, 'user-b');
  }
});
