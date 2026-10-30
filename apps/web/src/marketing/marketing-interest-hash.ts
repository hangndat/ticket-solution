/** Same-document hash updates via history.pushState do not fire hashchange (Next.js / App Router). */

export const INTEREST_HASH = '#interest';
export function interestHashActive() {
  if (typeof window === 'undefined') return false;
  return window.location.hash === INTEREST_HASH;
}

export function isInterestHref(href: string | null) {
  if (!href) return false;
  if (href === INTEREST_HASH || href.endsWith(INTEREST_HASH)) return true;
  try {
    const url = new URL(href, window.location.href);
    return url.hash === INTEREST_HASH;
  } catch {
    return false;
  }
}

export function notifyInterestHashListeners() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function setInterestHashInHistory() {
  if (typeof window === 'undefined') return;
  if (interestHashActive()) return;
  const path = `${window.location.pathname}${window.location.search}`;
  window.history.pushState(null, '', `${path}${INTEREST_HASH}`);
  notifyInterestHashListeners();
}

export function clearInterestHashFromHistory() {
  if (typeof window === 'undefined') return;
  if (!interestHashActive()) return;
  const path = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, '', path);
  notifyInterestHashListeners();
}
