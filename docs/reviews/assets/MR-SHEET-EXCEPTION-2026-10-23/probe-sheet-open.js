(function () {
  var d = document.querySelector('[role="dialog"]');
  var titleEl = document.querySelector('[role="dialog"] [id$="-title"]');
  var trig = document.getElementById("mkt-sheet-trigger") || document.getElementById("app-sheet-trigger");
  var active = document.activeElement;
  var focusInDialog = !!(d && active && d.contains(active));
  return JSON.stringify({
    surface: location.pathname.includes("marketing") ? "marketing" : "app",
    typeofVemokiSheetNav: typeof window.VemokiSheetNav,
    sheetRadix: !!(window.VemokiSheetNav && window.VemokiSheetNav.provenance && window.VemokiSheetNav.provenance.radixDialog),
    dialogPresent: !!d,
    dialogState: d ? d.getAttribute("data-state") : null,
    title: titleEl ? titleEl.textContent.trim() : null,
    navLinks: document.querySelectorAll('[role="dialog"] nav a, [role="dialog"] nav button').length,
    triggerExpanded: trig ? trig.getAttribute("aria-expanded") : null,
    focusInDialog: focusInDialog,
    activeTag: active ? active.tagName : null,
    locale: document.documentElement.lang,
    viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
  });
})();
