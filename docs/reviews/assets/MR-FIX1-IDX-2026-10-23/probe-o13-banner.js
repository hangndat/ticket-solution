(function () {
  const banner = document.querySelector('[role="status"]');
  const text = banner ? banner.textContent.replace(/\s+/g, " ").trim() : "";
  return JSON.stringify({
    bannerPresent: !!banner,
    hasSuperseded: /superseded|thay thế/i.test(text),
    hasCanonicalLink: !!document.querySelector('a[href*="ui-uplift-2026-10/marketing"]'),
    sample: text.slice(0, 120),
  });
})();
