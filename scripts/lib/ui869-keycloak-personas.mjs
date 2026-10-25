#!/usr/bin/env node
/**
 * Idempotent Keycloak user upsert for UI869 persona fixtures (loopback realm only).
 */
import { PERSONAS } from './ui869-persona-catalog.mjs';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

async function adminToken(base, user, pass) {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: user,
    password: pass,
  });
  const res = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`keycloak_admin_token_failed:${res.status}`);
  }
  return json.access_token;
}

async function findUser(base, token, realm, username) {
  const res = await fetch(
    `${base}/admin/realms/${realm}/users?username=${encodeURIComponent(username)}&exact=true`,
    {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!res.ok) throw new Error(`keycloak_user_lookup_failed:${username}:${res.status}`);
  const rows = await res.json();
  return rows[0]?.id || null;
}

async function upsertUser(base, token, realm, persona) {
  const existingId = await findUser(base, token, realm, persona.email);
  const payload = {
    username: persona.email,
    email: persona.email,
    emailVerified: true,
    enabled: true,
    firstName: persona.id,
    lastName: 'Fixture',
    requiredActions: [],
  };
  if (!existingId) {
    const create = await fetch(`${base}/admin/realms/${realm}/users`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    if (create.status !== 201) {
      throw new Error(`keycloak_user_create_failed:${persona.email}:${create.status}`);
    }
    const id = await findUser(base, token, realm, persona.email);
    if (!id) throw new Error(`keycloak_user_missing_after_create:${persona.email}`);
    await setPassword(base, token, realm, id, persona.password);
    return { email: persona.email, created: true };
  }
  await fetch(`${base}/admin/realms/${realm}/users/${existingId}`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  await setPassword(base, token, realm, existingId, persona.password);
  return { email: persona.email, created: false };
}

async function setPassword(base, token, realm, userId, password) {
  const res = await fetch(
    `${base}/admin/realms/${realm}/users/${userId}/reset-password`,
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ type: 'password', value: password, temporary: false }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!res.ok) throw new Error(`keycloak_password_reset_failed:${userId}:${res.status}`);
}

export async function ensureKeycloakPersonas(options = {}) {
  const issuer = (options.issuer || process.env.OIDC_ISSUER || 'http://127.0.0.1:8080/realms/ticket').replace(
    /\/$/,
    '',
  );
  const u = new URL(issuer);
  if (!LOOPBACK.has(u.hostname)) throw new Error('keycloak_persona_issuer_not_loopback');
  const base = `${u.protocol}//${u.host}`;
  const realm = u.pathname.split('/').filter(Boolean).pop() || 'ticket';
  const adminUser = options.adminUser || process.env.KEYCLOAK_ADMIN || 'admin';
  const adminPass = options.adminPassword || process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';
  const token = await adminToken(base, adminUser, adminPass);
  const results = [];
  for (const persona of PERSONAS) {
    if (persona.kind !== 'staff' && persona.id !== 'attendee') continue;
    if (persona.id === 'legacy-staff-owner') continue;
    results.push(await upsertUser(base, token, realm, persona));
  }
  return { realm, issuer, users: results };
}

import { fileURLToPath } from 'node:url';
import path from 'node:path';

const isMain =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMain) {
  ensureKeycloakPersonas()
    .then((r) => {
      console.log(JSON.stringify({ ok: true, ...r }));
    })
    .catch((e) => {
      console.error(JSON.stringify({ ok: false, error: e.message }));
      process.exitCode = 1;
    });
}
