(function () {
  var d = document.querySelector('[role="dialog"]');
  var menu = document.querySelector('[data-testid="mkt-nav-mobile-menu"]');
  var trig = document.querySelector('[data-testid="mkt-nav-menu-toggle"]');
  var active = document.activeElement;
  var focusInDialog = !!(d && active && d.contains(active));
  var links = d
    ? d.querySelectorAll('nav a, nav button, a[href]').length
    : 0;
  return JSON.stringify({
    surface: 'marketing-next',
    url: location.href,
    dialogPresent: !!d,
    menuTestId: !!menu,
    dialogState: d ? d.getAttribute('data-state') : null,
    overlay: !!document.querySelector('[data-testid="mkt-nav-mobile-backdrop"]'),
    navLinksInDialog: links,
    triggerExpanded: trig ? trig.getAttribute('aria-expanded') : null,
    focusInDialog: focusInDialog,
    activeTag: active ? active.tagName : null,
    locale: document.documentElement.lang || document.querySelector('[data-locale]')?.getAttribute('data-locale'),
    headerInterestVisible: !!(
      document.querySelector('[data-testid="cta-interest-nav"]') &&
      getComputedStyle(document.querySelector('[data-testid="cta-interest-nav"]')).display !== 'none'
    ),
    menuInterestVisible: !!document.querySelector('[data-testid="cta-interest-nav-mobile"]'),
    viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
  });
})();
