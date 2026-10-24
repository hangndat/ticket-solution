(function () {
  var trig = document.getElementById("mkt-sheet-trigger");
  if (trig) trig.click();
  return new Promise(function (resolve) {
    setTimeout(function () {
      var d = document.querySelector('[role="dialog"]');
      var titleEl = document.querySelector('[role="dialog"] [id$="-title"]');
      resolve(
        JSON.stringify({
          mount: !!document.getElementById("mkt-sheet-root-react"),
          clicked: !!trig,
          expanded: trig ? trig.getAttribute("aria-expanded") : null,
          dialogPresent: !!d,
          dialogState: d ? d.getAttribute("data-state") : null,
          title: titleEl ? titleEl.textContent.trim() : null,
        }),
      );
    }, 3000);
  });
})();
