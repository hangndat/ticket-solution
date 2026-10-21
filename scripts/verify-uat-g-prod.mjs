/**
 * Prod verify for UAT-G seed — prints only counts/status, no tokens/passwords.
 * Reads credentials from UAT_G_CREDENTIALS_FILE (KEY=value).
 */
import { readFileSync } from "node:fs";

const credPath = process.env.UAT_G_CREDENTIALS_FILE ?? "/secrets/uat-g/uat-g-credentials.txt";
const creds = Object.fromEntries(
  readFileSync(credPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const oidcClientSecret = process.env.OIDC_CLIENT_SECRET ?? "";
if (!oidcClientSecret) throw new Error("OIDC_CLIENT_SECRET missing");

const KC =
  process.env.KEYCLOAK_TOKEN_URL ??
  "http://vemoki-keycloak-1:8080/realms/ticket/protocol/openid-connect/token";
const API = process.env.API_BASE_URL ?? "http://vemoki-api-1:3001";
const TENANT_ID = "a1111111-1111-4111-8111-111111111111";
const EVENT_ID = "b2222222-2222-4222-8222-222222222222";

async function ropc(email, password) {
  const body = new URLSearchParams({
    client_id: "ticket-web",
    client_secret: oidcClientSecret,
    grant_type: "password",
    username: email,
    password,
    scope: "openid",
  });
  const res = await fetch(KC, { method: "POST", body });
  if (!res.ok) throw new Error(`ropc_http_${res.status}_${email}`);
  const json = await res.json();
  if (!json.access_token) throw new Error(`ropc_no_token_${email}`);
  return json.access_token;
}

const attToken = await ropc(creds.UAT_G_ATTENDEE_EMAIL, creds.UAT_G_ATTENDEE_PASSWORD);
const staffToken = await ropc(creds.UAT_G_STAFF_EMAIL, creds.UAT_G_STAFF_PASSWORD);
console.log("ropc_attendee=ok ropc_staff=ok");

const meRes = await fetch(`${API}/v1/me/tickets`, {
  headers: { Authorization: `Bearer ${attToken}`, Accept: "application/json" },
});
if (!meRes.ok) throw new Error(`me_tickets_http_${meRes.status}`);
const me = await meRes.json();
const active = (me.tickets ?? []).filter((t) => t.state === "ACTIVE");
console.log(`me_tickets_active_count=${active.length}`);

const sessRes = await fetch(`${API}/v1/gate/events/${EVENT_ID}/sessions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${staffToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ tenantId: TENANT_ID }),
});
if (!sessRes.ok) throw new Error(`gate_session_http_${sessRes.status}`);
const sess = await sessRes.json();
const staffSessionId = sess.sessionId ?? sess.staffSessionId ?? sess.id;
const revRes = await fetch(`${API}/v1/gate/events/${EVENT_ID}/sessions/revoke`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${staffToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ tenantId: TENANT_ID, staffSessionId }),
});
if (!revRes.ok) throw new Error(`gate_revoke_http_${revRes.status}`);
console.log(`gate_session_ok=1 gate_revoke_http=${revRes.status}`);
