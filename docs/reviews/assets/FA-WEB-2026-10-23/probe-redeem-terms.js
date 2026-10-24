(function () {
  var cb = document.querySelector('#terms-accepted, [data-testid="redeem-terms-consent"] input[type="checkbox"]');
  return JSON.stringify({
    consentBlock: !!document.querySelector('[data-testid="redeem-terms-consent"]'),
    checked: cb ? cb.checked : null,
    disabled: cb ? cb.disabled : null,
  });
})();
