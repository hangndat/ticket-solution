(function () {
  function visible(el) {
    if (!el) return false;
    var s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  var header = document.querySelector('[data-testid="app-header"], header');
  var navLinks = [...document.querySelectorAll('header a, header button, nav a, nav button')]
    .filter(visible)
    .map(function (el) {
      return {
        tag: el.tagName,
        testId: el.getAttribute('data-testid'),
        text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 48),
        href: el.getAttribute('href'),
      };
    });
  var grid = document.querySelector('[data-testid="home-catalog-grid"]');
  var events = grid
    ? [...grid.querySelectorAll('[data-testid^="home-event-"]')].filter(visible).length
    : 0;
  var upcomingPressed =
    document.querySelector('[data-testid="home-catalog-filter-upcoming"][aria-pressed="true"]') ||
    document.querySelector('[data-testid="home-catalog-filter-all"][aria-pressed="true"]');
  var pastPressed = document.querySelector(
    '[data-testid="home-catalog-filter-past"][aria-pressed="true"]',
  );
  return JSON.stringify({
    url: location.href,
    locale: document.documentElement.lang,
    viewport: { w: innerWidth, h: innerHeight },
    visibleHeaderControls: navLinks,
    catalog: {
      present: !!document.querySelector('[data-testid="home-catalog"]'),
      upcomingCount: events,
      upcomingChip: !!upcomingPressed,
      pastChipPressed: !!pastPressed,
    },
  });
})();
