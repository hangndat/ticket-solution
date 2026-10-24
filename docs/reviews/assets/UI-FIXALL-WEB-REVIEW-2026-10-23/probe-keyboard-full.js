(function () {
  function snap() {
    var d = document.querySelector('[role="dialog"]');
    var trig = document.querySelector('[data-testid="mkt-nav-menu-toggle"]');
    var active = document.activeElement;
    return {
      dialogOpen: !!(d && d.getAttribute('data-state') === 'open'),
      focusInDialog: !!(d && active && d.contains(active)),
      focusOnTrigger: !!(trig && active === trig),
      activeTestId: active ? active.getAttribute('data-testid') : null,
      activeTag: active ? active.tagName : null,
      activeText: active
        ? (active.innerText || active.getAttribute('aria-label') || '').trim().slice(0, 40)
        : null,
      triggerExpanded: trig ? trig.getAttribute('aria-expanded') : null,
    };
  }
  return JSON.stringify({ probe: 'keyboard-full', note: 'run steps via orca press', snap: snap() });
})();
