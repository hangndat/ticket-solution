(function () {
  var grid = document.querySelector('[data-testid="home-catalog-grid"]');
  var ids = grid
    ? [...grid.querySelectorAll('[data-testid^="home-event-"]')].map(function (el) {
        return el.getAttribute('data-testid');
      })
    : [];
  var active = document.querySelector('[data-testid="home-catalog-filter-past"][aria-pressed="true"], [data-testid="home-catalog-filter-past"].active');
  return JSON.stringify({
    catalogPresent: !!document.querySelector('[data-testid="home-catalog"]'),
    gridCount: ids.length,
    eventTestIds: ids.slice(0, 12),
    pastChip: !!document.querySelector('[data-testid="home-catalog-filter-past"]'),
  });
})();
