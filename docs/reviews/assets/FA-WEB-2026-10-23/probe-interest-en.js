(function () {
  var form = document.querySelector('[data-testid="interest-form"]');
  var labels = {};
  ['name', 'email', 'org', 'role'].forEach(function (field) {
    var el = form && form.querySelector('[name="' + field + '"]');
    var id = el && el.id;
    var label = id && document.querySelector('label[for="' + id + '"]');
    labels[field] = label ? label.textContent.trim() : null;
  });
  var consent = form && form.querySelector('[name="consent"]');
  return JSON.stringify({
    locale: document.documentElement.lang,
    formPresent: !!form,
    labels: labels,
    submitLabel: document.querySelector('[data-testid="interest-submit"]')?.textContent?.trim(),
    consentDefaultChecked: consent ? consent.checked : null,
  });
})();
