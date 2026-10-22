import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { POST } from '../app/api/marketing/interest/route';

describe('POST /api/marketing/interest', () => {
  let dir: string;
  let prevPath: string | undefined;
  let prevIdem: string | undefined;

  before(async () => {
    process.env.MARKETING_INTEREST_DISABLE_RETRY_SCHEDULE = '1';
    dir = await mkdtemp(join(tmpdir(), 'vemoki-interest-route-'));
    prevPath = process.env.MARKETING_INTEREST_PATH;
    prevIdem = process.env.MARKETING_INTEREST_IDEMPOTENCY_PATH;
    process.env.MARKETING_INTEREST_PATH = join(dir, 'interest.jsonl');
    process.env.MARKETING_INTEREST_IDEMPOTENCY_PATH = join(
      dir,
      'idempotency.json',
    );
  });

  after(async () => {
    if (prevPath === undefined) delete process.env.MARKETING_INTEREST_PATH;
    else process.env.MARKETING_INTEREST_PATH = prevPath;
    if (prevIdem === undefined) {
      delete process.env.MARKETING_INTEREST_IDEMPOTENCY_PATH;
    } else process.env.MARKETING_INTEREST_IDEMPOTENCY_PATH = prevIdem;
    await rm(dir, { recursive: true, force: true });
  });

  it('returns 400 on validation errors', async () => {
    const res = await POST(
      new Request('http://127.0.0.1/api/marketing/interest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      }),
    );
    assert.equal(res.status, 400);
    const json = (await res.json()) as { code: string };
    assert.equal(json.code, 'VALIDATION');
  });

  it('returns quickly when webhook handler is slow', async () => {
    process.env.MARKETING_INTEREST_WEBHOOK_URL = 'http://127.0.0.1:1/slow';
    const prevFetch = globalThis.fetch;
    globalThis.fetch = ((() =>
      new Promise((resolve) => {
        setTimeout(
          () => resolve(new Response('err', { status: 500 })),
          2_000,
        );
      })) as unknown) as typeof fetch;

    const started = Date.now();
    const res = await POST(
      new Request('http://127.0.0.1/api/marketing/interest', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'slow-webhook-route',
        },
        body: JSON.stringify({
          name: 'Slow',
          email: 'slow@example.com',
          org: 'Org',
          role: 'agency',
          consent: true,
        }),
      }),
    );
    const elapsed = Date.now() - started;
    globalThis.fetch = prevFetch;
    delete process.env.MARKETING_INTEREST_WEBHOOK_URL;

    assert.equal(res.status, 200);
    assert.ok(elapsed < 500, `route blocked ${elapsed}ms waiting on webhook`);
  });

  it('honors DNT — persists lead without server analytics', async () => {
    const res = await POST(
      new Request('http://127.0.0.1/api/marketing/interest', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          dnt: '1',
          'idempotency-key': 'dnt-route-key',
        },
        body: JSON.stringify({
          name: 'DNT',
          email: 'dnt@example.com',
          org: 'Org',
          role: 'owner',
          consent: true,
        }),
      }),
    );
    assert.equal(res.status, 200);
  });

  it('returns 200 with lead_id on valid payload', async () => {
    const res = await POST(
      new Request('http://127.0.0.1/api/marketing/interest', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-vemoki-locale': 'en',
        },
        body: JSON.stringify({
          name: 'Test',
          email: 'test@example.com',
          org: 'Org',
          role: 'agency',
          consent: true,
          events_per_year: '21+',
        }),
      }),
    );
    assert.equal(res.status, 200);
    const json = (await res.json()) as { ok: boolean; lead_id: string };
    assert.equal(json.ok, true);
    assert.match(json.lead_id, /^[0-9a-f-]{36}$/i);
  });

  it('honeypot returns 200 without persist semantics', async () => {
    const res = await POST(
      new Request('http://127.0.0.1/api/marketing/interest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Bot',
          email: 'bot@example.com',
          org: 'X',
          role: 'other',
          consent: true,
          website: 'http://spam.test',
        }),
      }),
    );
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
  });
});
