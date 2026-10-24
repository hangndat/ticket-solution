(() => {
  const site = document.querySelector(".browser .site") || document;
  const frame = document.getElementById("browser");
  const form = document.getElementById("interest-form");
  const labels = form
    ? [...form.querySelectorAll("label")].map((l) => l.textContent.trim())
    : [];
  const consent = document.getElementById("consent-label")?.textContent?.trim() || "";
  const terms = document.getElementById("terms-agree");
  const htmlLang = document.documentElement.lang;
  const localeVi = document.getElementById("locale-vi")?.getAttribute("aria-pressed");
  const localeEn = document.getElementById("locale-en")?.getAttribute("aria-pressed");
  const menu = document.getElementById("mkt-sheet-trigger") || document.getElementById("app-sheet-trigger");
  return JSON.stringify({
    htmlLang,
    localeViPressed: localeVi,
    localeEnPressed: localeEn,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    frameWidth: frame ? Math.round(frame.getBoundingClientRect().width) : null,
    interestLabels: labels,
    consentText: consent,
    termsChecked: terms ? terms.checked : null,
    menuExpanded: menu?.getAttribute("aria-expanded") || null,
  });
})();
