(function () {
  var reg = window.VemokiSheetNav && window.VemokiSheetNav._registry;
  var api = reg && reg.get("mkt-sheet-trigger");
  if (!api) return JSON.stringify({ err: "no-registry-api" });
  api.setOpen(true);
  return new Promise(function (resolve) {
    setTimeout(function () {
      var d = document.querySelector('[role="dialog"]');
      resolve(
        JSON.stringify({
          isOpen: api.isOpen(),
          dialogPresent: !!d,
          dialogState: d ? d.getAttribute("data-state") : null,
          expanded: document
            .getElementById("mkt-sheet-trigger")
            ?.getAttribute("aria-expanded"),
        }),
      );
    }, 2000);
  });
})();
