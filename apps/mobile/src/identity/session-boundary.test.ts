import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SessionBoundary, type CredentialStore } from './session-boundary.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture(initial: string | null = null) {
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
    store,
    credential: () => credential,
  };
}
const verify = async (credential: string) => ({ userId: credential });

test('restored credentials require server verification; no provider means signed out', async () => {
  const f = fixture('old-keychain-credential');
  assert.equal(f.boundary.getSnapshot().status, 'unknown');
  await f.boundary.restore();
  assert.equal(f.boundary.getSnapshot().status, 'signed-out');
  assert.equal(f.credential(), null);
});
test('account switch aborts old request and rejects late response despite ignored cancellation', async () => {
  const { boundary } = fixture();
  await boundary.establish('alice', verify);
  await boundary.load('tenant-a', 'tickets', async () => ['alice-private']);
  const late = deferred<string[]>();
  let signal!: AbortSignal;
  const request = boundary.load('tenant-a', 'tickets', (value) => {
    signal = value;
    return late.promise;
  });
  await boundary.establish('bob', verify);
  assert.equal(signal.aborted, true);
  assert.equal(boundary.read('tenant-a', 'tickets'), undefined);
  await boundary.load('tenant-a', 'tickets', async () => ['bob-private']);
  late.resolve(['alice-late']);
  assert.equal(await request, false);
  assert.deepEqual(boundary.read('tenant-a', 'tickets'), ['bob-private']);
  assert.equal(boundary.read('tenant-b', 'tickets'), undefined);
});
test('same user re-login has a new generation and cannot revive previous session data', async () => {
  const f = fixture();
  await f.boundary.establish('alice', verify);
  const late = deferred<string[]>();
  const request = f.boundary.load('tenant-a', 'tickets', () => late.promise);
  await f.boundary.logout();
  assert.equal(f.credential(), null);
  await f.boundary.establish('alice', verify);
  late.resolve(['previous-session']);
  assert.equal(await request, false);
  assert.equal(f.boundary.read('tenant-a', 'tickets'), undefined);
});
test('late credential restoration cannot undo logout', async () => {
  const f = fixture('alice');
  const late = deferred<{ userId: string }>();
  const started = deferred<void>();
  const restore = f.boundary.restore(async () => {
    started.resolve();
    return late.promise;
  });
  await started.promise;
  await f.boundary.logout();
  late.resolve({ userId: 'alice' });
  await restore;
  assert.equal(f.boundary.getSnapshot().status, 'signed-out');
  assert.equal(f.credential(), null);
});
test('serialized secure writes cannot resurrect credential after logout', async () => {
  const f = fixture();
  const writing = deferred<void>();
  const release = deferred<void>();
  const realWrite = f.store.write;
  f.store.write = async (credential) => {
    writing.resolve();
    await release.promise;
    await realWrite(credential);
  };
  const establish = f.boundary.establish('alice', verify);
  await writing.promise;
  const logout = f.boundary.logout();
  assert.equal(f.boundary.getSnapshot().status, 'signed-out');
  release.resolve();
  await Promise.all([establish, logout]);
  assert.equal(f.credential(), null);
});
test('getCredential returns SecureStore bearer only while verified', async () => {
  const f = fixture();
  assert.equal(await f.boundary.getCredential(), null);
  await f.boundary.establish('alice-token', verify);
  assert.equal(await f.boundary.getCredential(), 'alice-token');
  await f.boundary.logout();
  assert.equal(await f.boundary.getCredential(), null);
});

test('secure deletion failure propagates while private data remains inaccessible', async () => {
  const f = fixture();
  await f.boundary.establish('alice', verify);
  await f.boundary.load('tenant-a', 'tickets', async () => ['private']);
  f.store.clear = async () => {
    throw new Error('Keychain unavailable');
  };
  await assert.rejects(f.boundary.logout(), /Keychain unavailable/);
  assert.equal(f.boundary.read('tenant-a', 'tickets'), undefined);
  await assert.rejects(
    f.boundary.load('tenant-a', 'tickets', async () => ['private']),
    /Verified identity required/,
  );
});
