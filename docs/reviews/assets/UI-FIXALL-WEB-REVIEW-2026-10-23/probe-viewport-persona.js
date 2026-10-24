(function () {
  var email =
    document.querySelector('[data-testid="session-email"]') ||
    document.querySelector('[data-testid="user-menu"]') ||
    document.querySelector('[data-testid="account-email"]');
  var emailText = email ? (email.innerText || email.textContent || '').trim() : null;
  var mock = document.querySelector('[data-testid="mock-session"], [data-mock-session]');
  var bffEmail = null;
  try {
    var el = document.querySelector('[data-testid="account-page-email"], main');
    if (el && /attendee@example\.com|staff@example\.com/.test(el.innerText || '')) {
      bffEmail = (el.innerText.match(/[\w.+-]+@example\.com/) || [])[0] || null;
    }
  } catch (e) {}
  return JSON.stringify({
    measuredViewport: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
    url: location.href,
    locale: document.documentElement.lang || document.querySelector('[data-locale]')?.getAttribute('data-locale'),
    personaEmail: emailText || bffEmail,
    bffEmailFromDom: bffEmail,
    mockSessionMarker: !!mock,
    cookieNames: document.cookie
      ? document.cookie.split(';').map(function (c) {
          return c.trim().split('=')[0];
        })
      : [],
  });
})();
