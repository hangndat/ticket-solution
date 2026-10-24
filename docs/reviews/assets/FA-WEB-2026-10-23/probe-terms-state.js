(function () {
  var cb = document.getElementById('terms-accepted');
  var err = document.getElementById('field-error-terms');
  var alerts = Array.from(document.querySelectorAll('[role=alert]'))
    .map(function (el) {
      return el.textContent.trim().slice(0, 120);
    })
    .filter(Boolean);
  return JSON.stringify({
    consentPresent: !!document.querySelector('[data-testid="redeem-terms-consent"]'),
    checked: cb ? cb.checked : null,
    termsError: err ? err.textContent.trim() : null,
    alerts: alerts,
    submitDisabled: (function () {
      var b = document.querySelector('form button[type=submit]');
      return b ? b.disabled : null;
    })(),
  });
})();
