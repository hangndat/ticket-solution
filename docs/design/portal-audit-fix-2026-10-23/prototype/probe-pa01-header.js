// Probe PA-01 specimen: viewport, media query, field stack geometry.
(() => {
  const meta = document.querySelector('.demo-meta');
  const tenant = document.querySelector('[data-testid="tenant-switcher"]');
  const event = document.querySelector('[data-testid="event-switcher"]');
  const strip = document.querySelector('[data-testid="portal-context-strip"]');
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
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    devicePixelRatio: window.devicePixelRatio,
    mediaMin768: window.matchMedia('(min-width: 768px)').matches,
    metaText: meta?.innerText?.trim() ?? null,
    stripWidth: strip ? Math.round(strip.getBoundingClientRect().width) : null,
    tenant: tBox
      ? {
          top: Math.round(tBox.top),
          left: Math.round(tBox.left),
          width: Math.round(tBox.width),
          height: Math.round(tBox.height),
        }
      : null,
    event: eBox
      ? {
          top: Math.round(eBox.top),
          left: Math.round(eBox.left),
          width: Math.round(eBox.width),
          height: Math.round(eBox.height),
        }
      : null,
    layout: { stacked, sideBySide },
    expectBelow768Stack: window.innerWidth < 768 ? stacked === true : null,
  };
})();
