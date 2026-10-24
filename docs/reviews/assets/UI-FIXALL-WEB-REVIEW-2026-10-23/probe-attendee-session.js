(function () {
  var me = document.querySelector('[data-testid="session-email"], [data-testid="user-menu"]');
  var redeem = document.querySelector('[data-testid="redeem-form"], form');
  var mockBanner = document.querySelector('[data-testid="mock-session"], [data-mock-session]');
  return JSON.stringify({
    url: location.href,
    hasSessionUi: !!me,
    sessionSnippet: me ? (me.innerText || me.getAttribute('data-testid')).slice(0, 60) : null,
    redeemForm: !!redeem,
    mockSessionMarker: !!mockBanner,
    cookieNames: document.cookie
      ? document.cookie.split(';').map(function (c) {
          return c.trim().split('=')[0];
        })
      : [],
  });
})();
