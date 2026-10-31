import assert from 'node:assert/strict';
import test from 'node:test';
import { csrfJsonMutation } from '../src/bff/csrf-client';

async function browser(run: (state: { cookie: string }) => Promise<void>) {
  const originalDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    'document',
  );
  const originalFetch = globalThis.fetch;
  const state = { cookie: '' };
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: state,
  });
  try {
    await run(state);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument)
      Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
}

test('cold concurrent mutations bootstrap one real cookie before sending commands', () =>
  browser(async (state) => {
    let bootstraps = 0;
    let commands = 0;
    const token = 'a'.repeat(64);
    globalThis.fetch = async (input, init) => {
      if (input === '/api/bff/csrf') {
        bootstraps++;
        await Promise.resolve();
        state.cookie = `vemoki_csrf=${token}`;
        return Response.json({ ready: true });
      }
      commands++;
      assert.equal(new Headers(init?.headers).get('x-csrf-token'), token);
      return Response.json({ accepted: true }, { status: 201 });
    };
    const results = await Promise.all([
      csrfJsonMutation('/api/bff/redeem', { idempotencyKey: 'one' }, 1000),
      csrfJsonMutation('/api/bff/redeem', { idempotencyKey: 'two' }, 1000),
    ]);
    assert.equal(bootstraps, 1);
    assert.equal(commands, 2);
    assert.deepEqual(
      results.map((r) => r.status),
      [201, 201],
    );
  }));

test('pre-mutation CSRF rejection retries exactly once without changing the command', () =>
  browser(async (state) => {
    state.cookie = `vemoki_csrf=${'b'.repeat(64)}`;
    const bodies: string[] = [];
    let bootstraps = 0;
    globalThis.fetch = async (input, init) => {
      if (input === '/api/bff/csrf') {
        bootstraps++;
        state.cookie = `vemoki_csrf=${'c'.repeat(64)}`;
        return Response.json({ ready: true });
      }
      bodies.push(String(init?.body));
      return bodies.length === 1
        ? Response.json({ code: 'CSRF_TOKEN_INVALID' }, { status: 403 })
        : Response.json({ accepted: true }, { status: 201 });
    };
    assert.equal(
      (
        await csrfJsonMutation(
          '/api/bff/redeem',
          { idempotencyKey: 'stable', code: 'synthetic' },
          1000,
        )
      ).status,
      201,
    );
    assert.equal(bootstraps, 1);
    assert.equal(bodies.length, 2);
    assert.equal(bodies[0], bodies[1]);
  }));

test('authorization denial and uncertain transport never replay a mutation', () =>
  browser(async (state) => {
    state.cookie = `vemoki_csrf=${'d'.repeat(64)}`;
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return Response.json({ code: 'FORBIDDEN' }, { status: 403 });
    };
    assert.equal(
      (await csrfJsonMutation('/api/bff/redeem', {}, 1000)).status,
      403,
    );
    assert.equal(calls, 1);
    calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw new TypeError('network unavailable');
    };
    assert.equal(
      (await csrfJsonMutation('/api/bff/redeem', {}, 1000)).networkError,
      true,
    );
    assert.equal(calls, 1);
  }));
