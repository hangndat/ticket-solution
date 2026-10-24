(function () {
  var errs = [...document.querySelectorAll('[data-testid="interest-form"] [id$="-err-name"], [data-testid="interest-form"] [id$="-err-email"], [data-testid="interest-form"] [id$="-err-org"], [data-testid="interest-form"] [id$="-err-role"], [data-testid="interest-form"] [id$="-err-consent"]')]
    .map(function (el) {
      return (el.innerText || '').trim();
    })
    .filter(Boolean);
  return JSON.stringify({
    measuredViewport: {
      innerWidth: innerWidth,
      innerHeight: innerHeight,
      devicePixelRatio: devicePixelRatio,
    },
    locale: document.documentElement.lang,
    validationMessages: errs,
    hasEnterYourName: errs.some(function (m) {
      return /Enter your name/i.test(m);
    }),
    hasConsentRequired: errs.some(function (m) {
      return /Consent required/i.test(m);
    }),
  });
})();
