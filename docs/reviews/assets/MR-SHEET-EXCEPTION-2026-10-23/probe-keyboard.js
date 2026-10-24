(function () {
  var d = document.querySelector('[role="dialog"]');
  var trig =
    document.getElementById("mkt-sheet-trigger") ||
    document.getElementById("app-sheet-trigger");
  return JSON.stringify({
    surface: location.pathname.includes("marketing") ? "marketing" : "app",
    locale: document.documentElement.lang,
    triggerId: trig ? trig.id : null,
    dialogOpen: !!(d && d.getAttribute("data-state") === "open"),
    focusOnTrigger: trig && document.activeElement === trig,
    triggerExpanded: trig ? trig.getAttribute("aria-expanded") : null,
  });
})();
