(function () {
  var api = globalThis.__vemokiSheetApis && globalThis.__vemokiSheetApis["mkt-sheet-trigger"];
  if (!api) return JSON.stringify({ err: "no-api" });
  api.setOpen(true);
  return new Promise(function (resolve) {
    setTimeout(function () {
      var d = document.querySelector('[role="dialog"]');
      resolve(
        JSON.stringify({
          isOpen: api.isOpen(),
          dialogPresent: !!d,
          dialogState: d ? d.getAttribute("data-state") : null,
        }),
      );
    }, 1500);
  });
})();
