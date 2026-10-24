(function () {
  var cb = document.querySelector('#terms-accepted');
  var err = document.querySelector('[data-testid="redeem-terms-consent"] [role="alert"], [id*="terms"]');
  var texts = [...document.querySelectorAll('p, [role="alert"]')].map(function (el) {
    return (el.innerText || '').trim();
  }).filter(function (t) { return /điều khoản|terms/i.test(t); });
  return JSON.stringify({
    measuredViewport: { innerWidth: innerWidth, innerHeight: innerHeight, devicePixelRatio: devicePixelRatio },
    checked: cb ? cb.checked : null,
    termsTexts: texts.slice(0, 5),
    consentPresent: !!document.querySelector('[data-testid="redeem-terms-consent"]'),
  });
})();
