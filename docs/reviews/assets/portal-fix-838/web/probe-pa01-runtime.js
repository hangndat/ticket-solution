// PA-01 runtime probe — portal context strip + brand line count.
(() => {
  const brand = document.querySelector('[data-testid="portal-brand"]');
  const strip = document.querySelector('[data-testid="portal-context-strip"]');
  const tenant = document.querySelector('[data-testid="tenant-switcher"]');
  const event = document.querySelector('[data-testid="event-switcher"]');
  const hint = document.querySelector('[data-testid="gate-ios-scan-hint"]');
  const account = document.querySelector('[data-testid="account-menu"]');

  let brandLines = null;
  if (brand) {
    const range = document.createRange();
    range.selectNodeContents(brand);
    const tops = new Set(
      [...range.getClientRects()]
        .filter((r) => r.width > 1)
        .map((r) => Math.round(r.top)),
    );
    brandLines = tops.size;
  }

  const tBox = tenant?.getBoundingClientRect();
  const eBox = event?.getBoundingClientRect();
  const stacked =
    tBox && eBox
      ? Math.round(eBox.top) >= Math.round(tBox.bottom) - 2
      : null;
  const sideBySide =
    tBox && eBox
      ? Math.round(eBox.top) === Math.round(tBox.top) &&
        Math.round(eBox.left) > Math.round(tBox.left)
      : null;

  let hintLines = null;
  if (hint) {
    const range = document.createRange();
    range.selectNodeContents(hint);
    const tops = new Set(
      [...range.getClientRects()]
        .filter((r) => r.width > 1)
        .map((r) => Math.round(r.top)),
    );
    hintLines = tops.size;
  }

  const docEl = document.documentElement;
  const pageOverflowX =
    docEl.scrollWidth > docEl.clientWidth + 1 ||
    document.body.scrollWidth > document.body.clientWidth + 1;

  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    mediaMin768: window.matchMedia('(min-width: 768px)').matches,
    localeCookie: document.cookie.match(/portal_locale=([^;]+)/)?.[1] ?? null,
    brandLines,
    hintLines,
    pageOverflowX,
    hasStrip: Boolean(strip),
    hasAccount: Boolean(account),
    layout: { stacked, sideBySide },
    tenant: tBox
      ? {
          top: Math.round(tBox.top),
          width: Math.round(tBox.width),
          height: Math.round(tBox.height),
        }
      : null,
    event: eBox
      ? {
          top: Math.round(eBox.top),
          width: Math.round(eBox.width),
          height: Math.round(eBox.height),
        }
      : null,
  };
})();
