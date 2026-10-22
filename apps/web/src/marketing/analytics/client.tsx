'use client';

import { useEffect } from 'react';
import type { MarketingAnalyticsEventName } from './events';
import { shouldSkipMarketingAnalyticsClient } from './privacy-signals';

function sendEvent(
  event: MarketingAnalyticsEventName,
  props: Record<string, string | number | boolean | null>,
) {
  if (shouldSkipMarketingAnalyticsClient()) return;
  const payload = JSON.stringify({ event, props });
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon('/api/marketing/events', blob)) return;
    }
    void fetch('/api/marketing/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      keepalive: true,
    });
  } catch {
    /* fail-silent */
  }
}

function localeFromDom(): 'vi' | 'en' {
  const el = document.querySelector('[data-testid="marketing-surface"]');
  const raw = el?.getAttribute('data-locale');
  return raw === 'en' ? 'en' : 'vi';
}

/**
 * Minimal client island: CTA clicks + interest form lifecycle (no extra deps).
 */
export function MarketingAnalyticsClient() {
  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      const target = ev.target;
      if (!(target instanceof Element)) return;
      const cta = target.closest('[data-testid="cta-demo"], [data-testid="cta-interest"]');
      if (!cta) return;
      const id = cta.getAttribute('data-testid');
      if (id !== 'cta-demo' && id !== 'cta-interest') return;
      sendEvent('cta_click', { cta_id: id, locale: localeFromDom() });
    };

    const form = document.querySelector('[data-testid="interest-form"]');
    let formStarted = false;
    const onFormStart = () => {
      if (formStarted) return;
      formStarted = true;
      sendEvent('form_start', { locale: localeFromDom() });
    };

    document.addEventListener('click', onClick, { capture: true });
    form?.addEventListener('focusin', onFormStart, { capture: true });

    return () => {
      document.removeEventListener('click', onClick, { capture: true });
      form?.removeEventListener('focusin', onFormStart, { capture: true });
    };
  }, []);

  return null;
}

/** Lead funnel completion is recorded server-side after JSONL persist (no PII). */
export function trackLeadSubmitted() {
  /* intentionally no client beacon — see lead/server-analytics.ts */
}
