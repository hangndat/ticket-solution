import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decideHostRouting } from '../src/marketing/hosts';
import { journeyHref, localeSwitchHref } from '../src/marketing/links';
import { marketingPageMetadata } from '../src/marketing/seo/metadata';
import { marketingSitemapEntries } from '../src/marketing/seo/robots-sitemap';
import { JOURNEY_INDEXABLE } from '../src/marketing/journey/publication';
import { doorInset, T } from '../src/marketing/journey/timeline';
import { milestoneAt, oncePerView } from '../src/marketing/journey/progress';
import { validateMarketingAnalyticsBody } from '../src/marketing/analytics/validate';
import { POST } from '../app/api/marketing/events/route';

describe('cinematic journey release candidate', () => {
  it('opens continuously and reversibly without the old terminal jump', () => {
    assert.equal(doorInset(T.doorsOpen[0] - 0.1), 50);
    assert.equal(doorInset(T.doorsOpen[1] + 0.1), 0);
    let previous = 50;
    for (let p = T.doorsOpen[0]; p < T.doorsOpen[1] + 0.01; p += 0.001) {
      const inset = doorInset(p);
      assert.ok(inset <= previous && previous - inset < 0.85);
      assert.equal(doorInset(p), inset);
      previous = inset;
    }
    assert.ok(T.pushThrough[0] >= T.doorsOpen[1]);
  });

  it('maps public VI/EN paths without changing product home or auth', () => {
    for (const locale of ['vi', 'en'] as const) {
      const path = journeyHref(locale);
      for (const host of ['vemoki.com', '127.0.0.1', 'app.vemoki.com']) {
        assert.deepEqual(decideHostRouting({ host, pathname: path }), {
          type: 'rewrite', pathname: locale === 'vi' ? '/marketing/journey' : '/marketing/en/journey',
          locale, surface: 'marketing',
        });
      }
      assert.equal(localeSwitchHref(locale, 'journey', 'end'), `${path}#end`);
      const metadata = marketingPageMetadata({ locale, pageKind: 'journey', title: 'Journey', description: 'Journey' });
      assert.deepEqual(metadata.alternates?.languages, {
        vi: 'https://vemoki.com/experience', en: 'https://vemoki.com/en/experience', 'x-default': 'https://vemoki.com/experience',
      });
    }
    assert.deepEqual(decideHostRouting({ host: 'app.vemoki.com', pathname: '/' }), { type: 'next' });
    assert.deepEqual(decideHostRouting({ host: 'app.vemoki.com', pathname: '/auth' }), { type: 'next' });
  });

  it('excludes the unapproved experience from sitemap and keeps all existing URLs', () => {
    assert.equal(JOURNEY_INDEXABLE, false);
    assert.deepEqual(marketingSitemapEntries().map((e) => new URL(e.url).pathname), [
      '/', '/en', '/privacy', '/en/privacy', '/support', '/en/support',
    ]);
  });

  it('tracks chapters once across reverse scroll, skipped chapters and mode changes', () => {
    const sent: string[] = [];
    const reach = oncePerView((id) => sent.push(id));
    for (const p of [0, 0.1, 0.3, 0.5, 0.3, 0.5, 0.7, 0.95, 0.7, 1]) reach(milestoneAt(p));
    reach('moment');
    assert.deepEqual(sent, ['invitation', 'arrival', 'gateway', 'moment', 'complete']);
    assert.equal(milestoneAt(1), 'complete');
    const nextView = oncePerView((id) => sent.push(id));
    nextView('invitation');
    assert.equal(sent.length, 6);
  });

  it('accepts journey CTA source and rejects arbitrary source or milestone data', () => {
    assert.equal(validateMarketingAnalyticsBody({ event: 'cta_click', props: { cta_id: 'cta-demo', locale: 'vi', surface: 'journey' } }).ok, true);
    for (const props of [
      { cta_id: 'cta-demo', locale: 'vi', surface: 'unknown' },
      { cta_id: 'cta-demo', locale: 'vi', surface: 'journey', path: '/anything' },
    ]) assert.equal(validateMarketingAnalyticsBody({ event: 'cta_click', props }).ok, false);
    assert.equal(validateMarketingAnalyticsBody({ event: 'journey_progress', props: { milestone: 'freeform', locale: 'vi' } }).ok, false);
  });

  it('server accepts milestones and preserves the privacy opt-out', async () => {
    const request = (headers = {}) => new Request('http://127.0.0.1/api/marketing/events', {
      method: 'POST', headers: { host: '127.0.0.1', origin: 'http://127.0.0.1', 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ event: 'journey_progress', props: { milestone: 'complete', locale: 'en' } }),
    });
    assert.equal((await POST(request())).status, 200);
    for (const headers of [{ dnt: '1' }, { 'sec-gpc': '1' }]) {
      const response = await POST(request(headers));
      assert.equal((await response.json()).skipped, 'privacy');
    }
  });
});
