(function () {
  var sheet =
    document.querySelector('[data-testid="nav-mobile-menu"]') ||
    document.querySelector('[data-testid="mkt-nav-mobile-menu"]') ||
    document.querySelector('[data-slot="sheet-content"]');
  var rect = sheet ? sheet.getBoundingClientRect() : null;
  var cs = sheet ? getComputedStyle(sheet) : null;
  var w = rect ? Math.round(rect.width) : null;
  return JSON.stringify({
    surface: location.pathname.indexOf('marketing') >= 0 ? 'marketing' : 'consumer',
    viewport: { innerWidth: innerWidth, innerHeight: innerHeight, dpr: devicePixelRatio },
    dialogOpen: !!(document.querySelector('[role="dialog"][data-state="open"]')),
    widthComputed: cs ? cs.width : null,
    rectWidth: w,
    narrowStripe: w !== null && w < 120,
    cssSupportsOld: CSS.supports('width', 'min(100vw-3rem,20rem)'),
    cssSupportsFixed: CSS.supports('width', 'min(calc(100vw - 3rem), 20rem)'),
  });
})();
