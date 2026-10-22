/**
 * DNT / GPC — no tracking cookies; respect browser opt-out signals.
 */
export function shouldSkipMarketingAnalytics(
  headers: Headers | { get(name: string): string | null },
): boolean {
  const dnt = headers.get('dnt') ?? headers.get('DNT');
  if (dnt === '1') return true;
  const gpc = headers.get('sec-gpc') ?? headers.get('Sec-GPC');
  if (gpc === '1') return true;
  return false;
}

export function shouldSkipMarketingAnalyticsClient(): boolean {
  if (typeof navigator === 'undefined') return true;
  const dnt = (navigator as Navigator & { doNotTrack?: string }).doNotTrack;
  if (dnt === '1' || dnt === 'yes') return true;
  const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean })
    .globalPrivacyControl;
  if (gpc === true) return true;
  return false;
}
