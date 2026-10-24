(function () {
  var el = document.getElementById("mkt-sheet-root-react");
  return JSON.stringify({
    mount: !!el,
    htmlLen: el ? el.innerHTML.length : 0,
    portals: document.querySelectorAll("[data-radix-portal]").length,
    vemoki: typeof window.VemokiSheetNav,
  });
})();
