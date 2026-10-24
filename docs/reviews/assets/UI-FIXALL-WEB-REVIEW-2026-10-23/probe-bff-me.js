(async function () {
  const r = await fetch('/api/bff/me', { credentials: 'include' });
  const body = await r.json().catch(() => ({}));
  return JSON.stringify({ status: r.status, email: body.email, subject: body.subject });
})();
