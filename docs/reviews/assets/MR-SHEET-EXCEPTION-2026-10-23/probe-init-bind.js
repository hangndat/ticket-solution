(function () {
  var err = null;
  var api = null;
  try {
    api = window.VemokiSheetNav.bind({
      triggerId: "mkt-sheet-trigger",
      rootId: "mkt-sheet-root",
      getContent: function () {
        return { title: "Menu", closeLabel: "Close", links: [] };
      },
    });
  } catch (e) {
    err = String(e);
  }
  return JSON.stringify({
    err: err,
    api: !!api,
    mount: !!document.getElementById("mkt-sheet-root-react"),
    typeofBind: typeof window.VemokiSheetNav.bind,
  });
})();
