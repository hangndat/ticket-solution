(function () {
  var d = document.querySelector('[role="dialog"]');
  var trig = document.querySelector('[data-testid="nav-menu-toggle"],[data-testid="mkt-nav-menu-toggle"]');
  var active = document.activeElement;
  var inDialog = !!(d && active && d.contains(active));
  var anims = d ? d.getAnimations({ subtree: true }) : [];
  var animSnap = anims.slice(0, 4).map(function (a) {
    return {
      pending: a.pending,
      playState: a.playState,
      startTime: a.startTime,
      currentTime: a.currentTime,
    };
  });
  return JSON.stringify({
    timelineCurrentTime: document.timeline.currentTime,
    dialogPresent: !!d,
    dialogState: d ? d.getAttribute('data-state') : null,
    focusInClosedDialog:
      !!(d && d.getAttribute('data-state') === 'closed' && inDialog),
    focusOnTrigger: !!(trig && (active === trig || trig.contains(active))),
    activeTestId: active ? active.getAttribute('data-testid') : null,
    animCount: anims.length,
    animSnap: animSnap,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
})();
