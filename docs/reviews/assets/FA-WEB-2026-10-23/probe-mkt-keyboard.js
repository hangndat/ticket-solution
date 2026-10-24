(function () {
  var d = document.querySelector('[role="dialog"]');
  var trig = document.querySelector('[data-testid="mkt-nav-menu-toggle"]');
  return JSON.stringify({
    dialogOpen: !!(d && d.getAttribute('data-state') === 'open'),
    dialogPresent: !!d,
    focusOnTrigger: trig && document.activeElement === trig,
    triggerExpanded: trig ? trig.getAttribute('aria-expanded') : null,
  });
})();
