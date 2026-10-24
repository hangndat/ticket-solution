(function () {
  var d = document.querySelector('[role="dialog"]');
  var trig = document.querySelector('[data-testid="nav-menu-toggle"]');
  var active = document.activeElement;
  var hiddenFocus =
    active &&
    (active.offsetParent === null ||
      getComputedStyle(active).visibility === 'hidden' ||
      getComputedStyle(active).display === 'none' ||
      !document.body.contains(active));
  return JSON.stringify({
    measuredViewport: {
      innerWidth: innerWidth,
      innerHeight: innerHeight,
      devicePixelRatio: devicePixelRatio,
    },
    locale: document.documentElement.lang,
    dialogOpen: !!(d && d.getAttribute('data-state') === 'open'),
    triggerExpanded: trig ? trig.getAttribute('aria-expanded') : null,
    focusOnTrigger: !!(trig && active === trig),
    activeElement: {
      tag: active ? active.tagName : null,
      testId: active ? active.getAttribute('data-testid') : null,
      text: active
        ? (active.innerText || active.getAttribute('aria-label') || '').trim().slice(0, 40)
        : null,
      hiddenOrDetached: hiddenFocus,
    },
  });
})();
