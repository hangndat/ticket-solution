#!/usr/bin/env node
/** Fixture only: clear staff@example.com required actions + OTP creds for portal staff UAT. */
const base = process.env.KEYCLOAK_BASE || 'http://127.0.0.1:8080';

async function adminToken() {
  const body = new URLSearchParams({
    client_id: 'admin-cli',
    username: process.env.KEYCLOAK_ADMIN || 'admin',
    password: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
    grant_type: 'password',
  });
  const res = await fetch(
    `${base}/realms/master/protocol/openid-connect/token`,
    { method: 'POST', body },
  );
  const json = await res.json();
  if (!res.ok || !json.access_token) throw new Error('admin token failed');
  return json.access_token;
}

async function admin(method, path, token, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function main() {
  const token = await adminToken();
  const users = await admin(
    'GET',
    '/admin/realms/ticket/users?email=staff@example.com&exact=true',
    token,
  );
  const user = users?.[0];
  if (!user?.id) throw new Error('staff user not found');
  user.requiredActions = [];
  await admin('PUT', `/admin/realms/ticket/users/${user.id}`, token, user);
  console.log('PR846_KEYCLOAK_STAFF_RESET_OK');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
