import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { POST } from '../app/api/marketing/events/route';
import { MARKETING_ANALYTICS_EVENTS } from '../src/marketing/analytics/events';
import {
  __resetAnalyticsRateLimitForTests,
  clientKeyFromRequest,
  isAnalyticsRateLimited,
} from '../src/marketing/analytics/rate-limit';
import { shouldSkipMarketingAnalytics } from '../src/marketing/analytics/privacy-signals';
import { validateMarketingAnalyticsBody } from '../src/marketing/analytics/validate';

describe('marketing analytics validate', () => {
  it('allowlists known events only', () => {
    for (const event of MARKETING_ANALYTICS_EVENTS) {
      const r = validateMarketingAnalyticsBody({ event, props: { locale: 'vi' } });
      assert.equal(r.ok, true);
    }
    const bad = validateMarketingAnalyticsBody({ event: 'page_view', props: {} });
    assert.equal(bad.ok, false);
  });

  it('rejects PII in props', () => {
    const r = validateMarketingAnalyticsBody({
      event: 'cta_click',
      props: { email: 'a@b.com' },
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, 'PII');
  });

  it('respects DNT and GPC on server', () => {
    assert.equal(
      shouldSkipMarketingAnalytics(new Headers({ dnt: '1' })),
      true,
    );
    assert.equal(
      shouldSkipMarketingAnalytics(new Headers({ 'sec-gpc': '1' })),
      true,
    );
  });
});

describe('marketing analytics route', () => {
  it('accepts allowlisted event', async () => {
    __resetAnalyticsRateLimitForTests();
    const res = await POST(
      new Request('http://127.0.0.1/api/marketing/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event: 'cta_click',
          props: { cta_id: 'cta-demo', locale: 'vi' },
        }),
      }),
    );
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
  });

  it('rate limits burst traffic', async () => {
    __resetAnalyticsRateLimitForTests();
    const key = clientKeyFromRequest(
      new Request('http://127.0.0.1', {
        headers: { 'x-forwarded-for': '203.0.113.9' },
      }),
    );
    let limited = false;
    for (let i = 0; i < 65; i++) {
      if (isAnalyticsRateLimited(key)) {
        limited = true;
        break;
      }
    }
    assert.ok(limited);
  });

  it('skips when DNT is set', async () => {
    const res = await POST(
      new Request('http://127.0.0.1/api/marketing/events', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          dnt: '1',
        },
        body: JSON.stringify({ event: 'form_start', props: {} }),
      }),
    );
    assert.equal(res.status, 200);
    assert.equal((await res.json()).skipped, 'privacy');
  });
});
