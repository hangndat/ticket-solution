(function () {
  var d = document.querySelector('[role="dialog"]');
  var trig = document.querySelector('[data-testid="nav-menu-toggle"]');
  var menu = document.querySelector('[data-testid="nav-mobile-menu"]');
  var active = document.activeElement;
  return JSON.stringify({
    measuredViewport: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
    dialogOpen: !!(d && d.getAttribute('data-state') === 'open'),
    menuVisible: !!menu && getComputedStyle(menu).display !== 'none',
    focusOnTrigger: trig && active === trig,
    triggerExpanded: trig ? trig.getAttribute('aria-expanded') : null,
    activeTestId: active ? active.getAttribute('data-testid') : null,
  });
})();
