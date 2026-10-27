import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { MutationIntent, type IntentStorage } from '../src/client/mutation-intent';
import { mutationIntentAlertCopy } from '../src/client/mutation-intent-copy';
import { t } from '../src/i18n/t';
import type { PortalFetchResult } from '../src/client/portal-fetch';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const lost: PortalFetchResult = { status: 0, json: null, networkError: true, timedOut: true };
const ok = (): PortalFetchResult => ({
  status: 200,
  json: { dispatchedCount: 1, previewRevision: 1, replayed: false },
  networkError: false,
  timedOut: false,
});

function memoryStorage(): IntentStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

function readPortal(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

test('#929 leftover panels do not mint a new idempotency key per click', () => {
  for (const rel of [
    'src/ops/panels/import-invitations-panel.tsx',
    'src/ops/panels/notifications-templates-section.tsx',
    'src/ops/platform-mutate-panels.tsx',
  ]) {
    const src = readPortal(rel);
    assert.doesNotMatch(
      src,
      /idempotencyKey:\s*crypto\.randomUUID\(\)/,
      rel,
    );
    assert.match(src, /useMutationIntent/, rel);
  }
});

test('#929 dispatch-invitations lost-response and double-click reuse one key', async () => {
  const storage = memoryStorage();
  let keys = 0;
  const client = new MutationIntent(
    { actorId: 'staff-a', tenantId: 'tenant-a', eventId: 'event-a', command: 'dispatch-invitations' },
    storage,
    () => `dispatch-${++keys}`,
  );
  const committed = new Map<string, PortalFetchResult>();
  let effects = 0;
  const send = async (body: Record<string, unknown>) => {
    const key = String(body.idempotencyKey);
    if (!committed.has(key)) {
      effects += 1;
      committed.set(key, ok());
      return lost;
    }
    return committed.get(key)!;
  };
  const first = await client.run({ invitationIds: ['i1'], previewRevision: 1 }, send);
  assert.equal(first.kind, 'response');
  assert.equal(client.status?.state, 'unknown');
  const retry = await client.run({ invitationIds: ['i1'], previewRevision: 1 }, send);
  assert.deepEqual(retry, { kind: 'response', response: ok(), key: 'dispatch-1' });
  assert.equal(effects, 1);
  assert.equal(keys, 1);

  let finish!: (value: PortalFetchResult) => void;
  let markSent!: () => void;
  const sent = new Promise<void>((resolve) => { markSent = resolve; });
  let calls = 0;
  const inflight = new MutationIntent(
    { actorId: 'staff-a', tenantId: 'tenant-a', eventId: 'event-a', command: 'platform-provision' },
    memoryStorage(),
  );
  const sendOnce = () => {
    calls += 1;
    markSent();
    return new Promise<PortalFetchResult>((resolve) => { finish = resolve; });
  };
  const one = inflight.run({ slug: 'demo' }, sendOnce);
  const two = inflight.run({ slug: 'demo' }, sendOnce);
  assert.equal(one, two);
  await sent;
  finish(ok());
  await Promise.all([one, two]);
  assert.equal(calls, 1);
});

test('EN locale copy for unresolved mutation is not a success claim', () => {
  const copy = mutationIntentAlertCopy('unknown', true, 'en');
  assert.equal(copy.message, t('en', 'intent.unknownTitle'));
  assert.match(copy.description, /not prove success|unresolved/i);
  assert.doesNotMatch(copy.message, /success/i);
  assert.notEqual(t('en', 'locale.en'), t('vi', 'locale.label'));
});

test('shell EN fixture exposes keyboard locale controls and skip-link', () => {
  const html = readFileSync(join(here, 'fixtures/portal-shell-a11y.html'), 'utf8');
  assert.match(html, /lang="en"/);
  assert.match(html, /href="#portal-main" class="portal-skip-link"/);
  assert.match(html, /data-testid="portal-locale-en"/);
  assert.match(html, /aria-pressed="true"/);
  const skipAt = html.indexOf('portal-skip-link');
  const localeAt = html.indexOf('portal-locale-en');
  const mainAt = html.indexOf('id="portal-main"');
  assert.ok(skipAt < localeAt && localeAt < mainAt);
});
