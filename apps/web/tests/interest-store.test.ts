import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import {
  appendInterestRecord,
  persistInterestSubmission,
  resolveInterestPath,
} from '../src/marketing/interest-store';

describe('interest-store durable JSONL', () => {
  let dir: string;
  let prevPath: string | undefined;
  let prevWebhook: string | undefined;
  let prevIdem: string | undefined;

  before(async () => {
    process.env.MARKETING_INTEREST_DISABLE_RETRY_SCHEDULE = '1';
    dir = await mkdtemp(join(tmpdir(), 'vemoki-interest-'));
    prevPath = process.env.MARKETING_INTEREST_PATH;
    prevWebhook = process.env.MARKETING_INTEREST_WEBHOOK_URL;
    prevIdem = process.env.MARKETING_INTEREST_IDEMPOTENCY_PATH;
    process.env.MARKETING_INTEREST_PATH = join(dir, 'interest.jsonl');
    process.env.MARKETING_INTEREST_IDEMPOTENCY_PATH = join(
      dir,
      'idempotency.json',
    );
    delete process.env.MARKETING_INTEREST_WEBHOOK_URL;
  });

  after(async () => {
    if (prevPath === undefined) delete process.env.MARKETING_INTEREST_PATH;
    else process.env.MARKETING_INTEREST_PATH = prevPath;
    if (prevWebhook === undefined) {
      delete process.env.MARKETING_INTEREST_WEBHOOK_URL;
    } else {
      process.env.MARKETING_INTEREST_WEBHOOK_URL = prevWebhook;
    }
    if (prevIdem === undefined) {
      delete process.env.MARKETING_INTEREST_IDEMPOTENCY_PATH;
    } else {
      process.env.MARKETING_INTEREST_IDEMPOTENCY_PATH = prevIdem;
    }
    await rm(dir, { recursive: true, force: true });
  });

  it('resolveInterestPath uses MARKETING_INTEREST_PATH', () => {
    assert.equal(
      resolveInterestPath(),
      join(dir, 'interest.jsonl'),
    );
  });

  it('appendInterestRecord writes JSONL lines that survive process', async () => {
    await appendInterestRecord({
      name: 'A',
      email: 'a@example.com',
      org: 'Org',
      role: 'owner',
      note: '',
      consent: true,
      at: '2026-10-18T00:00:00.000Z',
      source: 'marketing-interest',
    });
    await appendInterestRecord({
      name: 'B',
      email: 'b@example.com',
      org: 'Agency',
      role: 'agency',
      note: 'hi',
      consent: true,
      at: '2026-10-18T00:01:00.000Z',
      source: 'marketing-interest',
      clientKey: '1.2.3.4',
    });

    const raw = await readFile(join(dir, 'interest.jsonl'), 'utf8');
    const lines = raw.trim().split('\n');
    assert.equal(lines.length, 2);
    const second = JSON.parse(lines[1]!) as {
      payload: { name: string };
      client_key?: string;
    };
    assert.equal(second.payload.name, 'B');
    assert.equal(second.client_key, '1.2.3.4');
  });

  it('persistInterestSubmission returns record and appends', async () => {
    const record = await persistInterestSubmission(
      {
        name: 'C',
        email: 'c@example.com',
        org: 'Co',
        role: 'other',
        note: 'n',
        consent: true,
      },
      { clientKey: 'local' },
    );
    assert.equal(record.payload.name, 'C');
    assert.equal(record.source, 'marketing-interest');
    assert.match(record.at, /^\d{4}-\d{2}-\d{2}T/);

    const raw = await readFile(join(dir, 'interest.jsonl'), 'utf8');
    assert.match(raw, /"email":"c@example.com"/);
  });
});
