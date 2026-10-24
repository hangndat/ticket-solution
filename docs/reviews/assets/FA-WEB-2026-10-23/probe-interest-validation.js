(function () {
  var form = document.querySelector('[data-testid="interest-form"]');
  function errText(suffix) {
    var el = document.querySelector('[id$="' + suffix + '"]');
    return el ? el.textContent.trim() : null;
  }
  return JSON.stringify({
    locale: document.documentElement.lang,
    noValidate: form ? form.noValidate : null,
    nameError: errText('-err-name'),
    emailError: errText('-err-email'),
    consentError: errText('-err-consent'),
  });
})();
