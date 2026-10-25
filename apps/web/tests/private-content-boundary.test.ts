import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import {
  PrivateContentBoundary,
  isPrivateConsumerPath,
} from '../src/private-content-boundary';
import { PrivateContentTrust } from '../src/private-content-trust';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  return { promise: new Promise<T>((done) => { resolve = done; }), resolve };
};

test('consumer layout boundary does not server-render private children before trust', () => {
  const privateHtml = renderToStaticMarkup(createElement(
    PathnameContext.Provider,
    { value: '/wallet' },
    createElement(
      PrivateContentBoundary,
      { initialSubject: 'subject-a' },
      createElement('a', { href: '/t/demo/tickets/a' }, 'A ticket'),
    ),
  ));
  assert.doesNotMatch(privateHtml, /A ticket|\/t\/demo\/tickets\/a/);
  assert.match(privateHtml, /consumer-private-pending/);
  assert.match(privateHtml, /class="min-w-0 w-full flex-1"/);
  assert.match(privateHtml, /max-w-\[64rem\]/);
  assert.equal(isPrivateConsumerPath('/wallet'), true);
  assert.equal(isPrivateConsumerPath('/account'), true);
  assert.equal(isPrivateConsumerPath('/redeem'), true);
  assert.equal(isPrivateConsumerPath('/t/demo/tickets/id'), true);
  assert.equal(isPrivateConsumerPath('/t/demo/events/show'), false);
  assert.equal(isPrivateConsumerPath('/'), false);
});

test('A to B masks private DOM synchronously, ignores stale completion, and reloads', async () => {
  const first = deferred<string | null>();
  const second = deferred<string | null>();
  const reads = [first.promise, second.promise];
  const states: string[] = [];
  let masked = 0;
  let reloaded = 0;
  const trust = new PrivateContentTrust({
    initialSubject: 'subject-a',
    readSubject: () => reads.shift()!,
    mask: () => { masked += 1; },
    publish: (state) => { states.push(state); },
    reload: () => { reloaded += 1; },
  });
  const old = trust.verify();
  const current = trust.verify();
  assert.equal(masked, 2, 'mask before either deferred discovery can settle');
  first.resolve('subject-a');
  await old;
  assert.equal(states.at(-1), 'pending', 'stale A cannot restore content');
  second.resolve('subject-b');
  await current;
  assert.equal(reloaded, 1);
  assert.equal(states.at(-1), 'pending', 'A stays masked until new document');
});

test('a completion for an earlier route cannot verify a history-restored private route', async () => {
  const delayed = deferred<string | null>();
  let epoch = 1;
  const published: Array<{ state: string; epoch: number }> = [];
  const trust = new PrivateContentTrust({
    initialSubject: 'subject-a',
    context: () => epoch,
    readSubject: () => delayed.promise,
    mask: () => {},
    publish: (state, context) => published.push({ state, epoch: context }),
    reload: () => { throw new Error('unexpected reload'); },
  });
  const pending = trust.verify();
  epoch = 2; // client navigation/back committed before the old /me response
  delayed.resolve('subject-a');
  await pending;
  assert.deepEqual(published.at(-1), { state: 'verified', epoch: 1 });
  assert.notEqual(published.at(-1)?.epoch, epoch);
});

test('guest revoke and unknown discovery never restore prior private content', async () => {
  const cases: Array<() => Promise<string | null>> = [
    async () => null,
    async () => { throw new Error('offline'); },
  ];
  for (const readSubject of cases) {
    const states: string[] = [];
    let reloaded = 0;
    const trust = new PrivateContentTrust({
      initialSubject: 'subject-a', readSubject,
      mask: () => {}, publish: (state) => { states.push(state); },
      reload: () => { reloaded += 1; },
    });
    await trust.verify();
    assert.ok(!states.includes('verified'));
    assert.equal(reloaded, readSubject === cases[0] ? 1 : 0);
    assert.equal(states.at(-1), readSubject === cases[0] ? 'pending' : 'error');
  }
});

test('same subject restores content; pagehide, focus and bfcache run the bound lifecycle', async () => {
  const events = new EventTarget();
  const documentEvents = new EventTarget();
  let visible = true;
  let reads = 0;
  const states: string[] = [];
  let masks = 0;
  const trust = new PrivateContentTrust({
    initialSubject: 'subject-a',
    readSubject: async () => { reads += 1; return 'subject-a'; },
    mask: () => { masks += 1; },
    publish: (state) => { states.push(state); },
    reload: () => { throw new Error('unexpected reload'); },
  });
  const unbind = trust.bind(events, documentEvents, () => visible);
  await trust.verify();
  assert.equal(states.at(-1), 'verified');
  events.dispatchEvent(new Event('blur'));
  assert.equal(states.at(-1), 'pending');
  events.dispatchEvent(new Event('pagehide'));
  assert.equal(states.at(-1), 'pending');
  const restored = new Event('pageshow') as Event & { persisted: boolean };
  restored.persisted = true;
  events.dispatchEvent(restored);
  await Promise.resolve();
  assert.equal(states.at(-1), 'verified');
  visible = false;
  documentEvents.dispatchEvent(new Event('visibilitychange'));
  assert.equal(states.at(-1), 'pending');
  visible = true;
  documentEvents.dispatchEvent(new Event('visibilitychange'));
  await Promise.resolve();
  events.dispatchEvent(new Event('focus'));
  await Promise.resolve();
  assert.equal(states.at(-1), 'verified');
  assert.ok(reads >= 3);
  assert.ok(masks >= 4);
  unbind();
});
