(function () {
  const ids = [
    "top",
    "trust",
    "features",
    "how-it-works",
    "solutions",
    "outcomes",
    "faq",
    "interest",
  ];
  const sections = ids.map((id) => ({ id, ok: !!document.getElementById(id) }));
  const prov = window.VemokiSheetNav && window.VemokiSheetNav.provenance;
  return JSON.stringify({
    surface: location.pathname.includes("marketing") ? "marketing" : "app",
    viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
    locale: document.documentElement.lang,
    sections,
    sheetRadix: !!(prov && prov.radixDialog),
    termsUnchecked:
      document.getElementById("terms-agree") &&
      !document.getElementById("terms-agree").checked,
    termsH1: document.querySelector("main h1")
      ? document.querySelector("main h1").textContent.trim()
      : null,
  });
})();
