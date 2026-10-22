import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { InterestPayload } from '../src/marketing/interest-schema';
import { acceptMarketingLead } from '../src/marketing/lead/accept-lead';
import { buildIdempotencyKey } from '../src/marketing/lead/idempotency';
import { createDefaultLeadSink } from '../src/marketing/lead/sink';
import {
  setMarketingAnalyticsAdapter,
  trackMarketingEvent,
} from '../src/marketing/analytics/track';

describe('acceptMarketingLead / LeadSink', () => {
  let dir: string;
  let prevPath: string | undefined;
  let prevIdem: string | undefined;
  let prevWebhook: string | undefined;
  const events: Array<{ event: string; props: Record<string, unknown> }> = [];

  before(async () => {
    process.env.MARKETING_INTEREST_DISABLE_RETRY_SCHEDULE = '1';
    dir = await mkdtemp(join(tmpdir(), 'vemoki-lead-'));
    prevPath = process.env.MARKETING_INTEREST_PATH;
    prevIdem = process.env.MARKETING_INTEREST_IDEMPOTENCY_PATH;
    prevWebhook = process.env.MARKETING_INTEREST_WEBHOOK_URL;
    process.env.MARKETING_INTEREST_PATH = join(dir, 'interest.jsonl');
    process.env.MARKETING_INTEREST_IDEMPOTENCY_PATH = join(
      dir,
      'idempotency.json',
    );
    delete process.env.MARKETING_INTEREST_WEBHOOK_URL;
    setMarketingAnalyticsAdapter({
      record(event, props) {
        events.push({ event, props: { ...props } });
      },
    });
  });

  after(async () => {
    setMarketingAnalyticsAdapter({ record() {} });
    if (prevPath === undefined) delete process.env.MARKETING_INTEREST_PATH;
    else process.env.MARKETING_INTEREST_PATH = prevPath;
    if (prevIdem === undefined) {
      delete process.env.MARKETING_INTEREST_IDEMPOTENCY_PATH;
    } else process.env.MARKETING_INTEREST_IDEMPOTENCY_PATH = prevIdem;
    if (prevWebhook === undefined) {
      delete process.env.MARKETING_INTEREST_WEBHOOK_URL;
    } else {
      process.env.MARKETING_INTEREST_WEBHOOK_URL = prevWebhook;
    }
    await rm(dir, { recursive: true, force: true });
  });

  it('persists JSONL and emits server analytics without PII', async () => {
    events.length = 0;
    const payload = {
      name: 'Ada',
      email: 'ada@example.com',
      org: 'Org',
      role: 'agency' as const,
      org_kind: 'agency' as const,
      note: '',
      consent: true as const,
      events_per_year: '21+' as const,
    };
    const result = await acceptMarketingLead(payload, { locale: 'en' });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.duplicate, false);
    assert.ok(result.record.qualified);

    const raw = await readFile(join(dir, 'interest.jsonl'), 'utf8');
    assert.match(raw, /"lead_id"/);
    assert.match(raw, /"ada@example.com"/);

    const qualified = events.find((e) => e.event === 'qualified_lead');
    assert.ok(qualified);
    assert.equal(qualified.props.locale, 'en');
    assert.ok(qualified.props.lead_id);
    assert.ok(!('email' in qualified.props));
    assert.ok(!('name' in qualified.props));
  });

  it('idempotency key is stable per email+day', () => {
    const a = buildIdempotencyKey('Ada@Example.com');
    const b = buildIdempotencyKey('ada@example.com');
    assert.equal(a, b);
  });

  it('webhook failure still persists and returns ok', async () => {
    process.env.MARKETING_INTEREST_WEBHOOK_URL = 'http://127.0.0.1:1/nope';
    const sink = createDefaultLeadSink(async () => {
      throw new Error('down');
    });
    const result = await acceptMarketingLead(
      {
        name: 'B',
        email: 'b@example.com',
        org: 'Co',
        role: 'owner' as const,
        note: '',
        consent: true as const,
      },
      { sink, idempotencyHeader: 'test-key-b' },
    );
    assert.equal(result.ok, true);
    delete process.env.MARKETING_INTEREST_WEBHOOK_URL;
  });

  it('duplicate idempotency does not append second line', async () => {
    const key = 'dup-test-key';
    const payload: InterestPayload = {
      name: 'C',
      email: 'c@example.com',
      org: 'Co',
      role: 'owner',
      note: '',
      consent: true,
    };
    const first = await acceptMarketingLead(payload, {
      idempotencyHeader: key,
    });
    const second = await acceptMarketingLead(payload, {
      idempotencyHeader: key,
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(second.duplicate, true);
    assert.equal(first.record.lead_id, second.record.lead_id);
    const raw = await readFile(join(dir, 'interest.jsonl'), 'utf8');
    const lines = raw.trim().split('\n').filter(Boolean);
    const cLines = lines.filter((l) => l.includes('c@example.com'));
    assert.equal(cLines.length, 1);
  });
});

describe('trackMarketingEvent PII guard', () => {
  it('does not require client route for qualified_lead', () => {
    trackMarketingEvent('qualified_lead', {
      locale: 'vi',
      lead_id: 'uuid',
      score: 65,
      tier: 'B',
      signals: 'role_agency',
    });
  });
});
