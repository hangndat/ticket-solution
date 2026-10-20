import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  encodeCredentialEnvelope,
  parseStoredCredential,
} from './credential-envelope.ts';
import type { RefreshOidcTokens } from './oidc-refresh.ts';
import {
  CREDENTIAL_UNREACHABLE,
  SessionBoundary,
  type CredentialStore,
} from './session-boundary.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture(
  initial: string | null = null,
  refreshTokens?: RefreshOidcTokens,
) {
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
    boundary: new SessionBoundary(store, refreshTokens),
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

test('unreachable restore keeps credential but never elevates to verified', async () => {
  const f = fixture('keychain-token');
  const outcome = await f.boundary.restore(async () => CREDENTIAL_UNREACHABLE);
  assert.equal(outcome, 'unreachable');
  assert.equal(f.boundary.getSnapshot().status, 'signed-out');
  assert.equal(f.credential(), 'keychain-token');
});

test('unreachable establish persists bearer for later restore; never verified', async () => {
  const f = fixture('stale-prior');
  await f.boundary.establish('fresh-oidc-token', async () => CREDENTIAL_UNREACHABLE);
  assert.equal(f.boundary.getSnapshot().status, 'signed-out');
  assert.equal(f.credential(), 'fresh-oidc-token');
  assert.equal(await f.boundary.getCredential(), null);
  const outcome = await f.boundary.restore(async () => ({ userId: 'staff-1' }));
  assert.equal(outcome, 'verified');
  assert.equal(await f.boundary.getCredential(), 'fresh-oidc-token');
});

test('rejected restore still clears credential (invalid/revoked)', async () => {
  const f = fixture('keychain-token');
  const outcome = await f.boundary.restore(async () => null);
  assert.equal(outcome, 'signed-out');
  assert.equal(f.boundary.getSnapshot().status, 'signed-out');
  assert.equal(f.credential(), null);
});

test('epoch capture guards stale work across logout and same-user re-login', async () => {
  const f = fixture();
  await f.boundary.establish('alice', verify);
  const epoch = f.boundary.captureEpoch();
  assert.ok(epoch);
  assert.equal(f.boundary.isEpochCurrent(epoch), true);
  await f.boundary.logout();
  assert.equal(f.boundary.isEpochCurrent(epoch), false);
  await f.boundary.establish('alice', verify);
  assert.equal(f.boundary.isEpochCurrent(epoch), false);
  const next = f.boundary.captureEpoch();
  assert.ok(next);
  assert.notEqual(next.generation, epoch!.generation);
  assert.equal(f.boundary.isEpochCurrent(next), true);
});

test('beginRequest aborts on account switch so fetch outside load is cancelled', async () => {
  const { boundary } = fixture();
  await boundary.establish('alice', verify);
  const controller = boundary.beginRequest();
  assert.equal(controller.signal.aborted, false);
  await boundary.establish('bob', verify);
  assert.equal(controller.signal.aborted, true);
  boundary.endRequest(controller);
});

test('getCredential refreshes expired access token transparently', async () => {
  let refreshCalls = 0;
  const refresh: RefreshOidcTokens = async () => {
    refreshCalls += 1;
    return {
      ok: true,
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresIn: 300,
    };
  };
  const f = fixture(null, refresh);
  await f.boundary.establish('old-access', verify, {
    refreshToken: 'old-refresh',
    expiresIn: 300,
  });
  // Force near-expiry without waiting for wall clock.
  await f.store.write(
    encodeCredentialEnvelope({
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      expiresIn: 0,
    }),
  );
  assert.equal(await f.boundary.getCredential(), 'new-access');
  assert.equal(refreshCalls, 1);
  assert.equal(parseStoredCredential(f.credential()!).accessToken, 'new-access');
  assert.equal(f.boundary.getSnapshot().status, 'verified');
});

test('refresh auth failure signs out and clears credential', async () => {
  const refresh: RefreshOidcTokens = async () => ({
    ok: false,
    reason: 'auth',
  });
  const f = fixture(null, refresh);
  await f.boundary.establish('old-access', verify, {
    refreshToken: 'revoked-refresh',
    expiresIn: 300,
  });
  await f.store.write(
    encodeCredentialEnvelope({
      accessToken: 'old-access',
      refreshToken: 'revoked-refresh',
      expiresIn: 0,
    }),
  );
  assert.equal(await f.boundary.getCredential(), null);
  assert.equal(f.boundary.getSnapshot().status, 'signed-out');
  assert.equal(f.credential(), null);
});

test('refresh network failure does not logout; signals unreachable instead of expired bearer', async () => {
  const refresh: RefreshOidcTokens = async () => ({
    ok: false,
    reason: 'network',
  });
  const f = fixture(null, refresh);
  await f.boundary.establish('old-access', verify, {
    refreshToken: 'rt',
    expiresIn: 300,
  });
  await f.store.write(
    encodeCredentialEnvelope({
      accessToken: 'old-access',
      refreshToken: 'rt',
      expiresIn: 0,
    }),
  );
  assert.deepEqual(await f.boundary.resolveCredential(), {
    status: 'refresh-unreachable',
  });
  assert.equal(await f.boundary.getCredential(), null);
  assert.equal(f.boundary.getSnapshot().status, 'verified');
  assert.ok(f.credential());
});

test('restore refresh auth failure returns signed-out without verified identity', async () => {
  const refresh: RefreshOidcTokens = async () => ({
    ok: false,
    reason: 'auth',
  });
  const expired = encodeCredentialEnvelope({
    accessToken: 'stale',
    refreshToken: 'bad-rt',
    expiresIn: 0,
  });
  const f = fixture(expired, refresh);
  const outcome = await f.boundary.restore(async () => ({ userId: 'should-not-run' }));
  assert.equal(outcome, 'signed-out');
  assert.equal(f.boundary.getSnapshot().status, 'signed-out');
  assert.equal(f.credential(), null);
});

test('restore refresh network failure keeps credential as unreachable', async () => {
  const refresh: RefreshOidcTokens = async () => ({
    ok: false,
    reason: 'network',
  });
  const expired = encodeCredentialEnvelope({
    accessToken: 'stale',
    refreshToken: 'rt',
    expiresIn: 0,
  });
  const f = fixture(expired, refresh);
  const outcome = await f.boundary.restore(async () => ({ userId: 'should-not-run' }));
  assert.equal(outcome, 'unreachable');
  assert.equal(f.boundary.getSnapshot().status, 'signed-out');
  assert.ok(f.credential());
});

test('establish with refreshToken persists envelope; getCredential returns access token only', async () => {
  const f = fixture(null, async () => ({
    ok: false,
    reason: 'config',
  }));
  await f.boundary.establish('access-1', verify, {
    refreshToken: 'refresh-1',
    expiresIn: 600,
  });
  const stored = parseStoredCredential(f.credential()!);
  assert.equal(stored.accessToken, 'access-1');
  assert.equal(stored.refreshToken, 'refresh-1');
  assert.equal(await f.boundary.getCredential(), 'access-1');
});

