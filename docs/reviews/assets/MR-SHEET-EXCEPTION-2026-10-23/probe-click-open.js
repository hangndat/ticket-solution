(function () {
  var trig =
    document.getElementById("mkt-sheet-trigger") ||
    document.getElementById("app-sheet-trigger");
  if (trig) trig.click();
  return new Promise(function (resolve) {
    setTimeout(function () {
      var d = document.querySelector('[role="dialog"]');
      resolve(
        JSON.stringify({
          clicked: !!trig,
          dialogPresent: !!d,
          dialogState: d ? d.getAttribute("data-state") : null,
          triggerExpanded: trig ? trig.getAttribute("aria-expanded") : null,
          mount: document.getElementById("mkt-sheet-root-react")
            ? document.getElementById("mkt-sheet-root-react").innerHTML.length
            : 0,
        }),
      );
    }, 2500);
  });
})();
