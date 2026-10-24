(function () {
  var api = window.VemokiSheetNav.bind({
    triggerId: "mkt-sheet-trigger",
    rootId: "mkt-sheet-root",
    getContent: function () {
      return {
        title: "Menu",
        closeLabel: "Đóng",
        navLabel: "Main",
        links: [{ href: "#features", label: "Features" }],
      };
    },
  });
  api.setOpen(true);
  return new Promise(function (resolve) {
    setTimeout(function () {
      var d = document.querySelector('[role="dialog"]');
      resolve(
        JSON.stringify({
          isOpen: api.isOpen(),
          dialogPresent: !!d,
          dialogState: d ? d.getAttribute("data-state") : null,
          title: document.querySelector('[role="dialog"] [id$="-title"]')?.textContent,
        }),
      );
    }, 2000);
  });
})();
