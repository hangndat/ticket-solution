(function () {
  return JSON.stringify({
    device: typeof window.device,
    vemoki: typeof window.VemokiSheetNav,
    bind: !!(window.VemokiSheetNav && window.VemokiSheetNav.bind),
    apis: globalThis.__vemokiSheetApis
      ? Object.keys(globalThis.__vemokiSheetApis)
      : null,
    trigger: !!document.getElementById("mkt-sheet-trigger"),
  });
})();
