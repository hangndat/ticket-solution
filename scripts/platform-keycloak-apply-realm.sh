#!/usr/bin/env bash
# Apply OTP browser flow + bind to platform/admin clients on a running Keycloak.
# Idempotent. Prefer task-stack issuer:
#   D5_PLATFORM_OIDC_ISSUER=http://127.0.0.1:18089/realms/ticket ./scripts/platform-keycloak-apply-realm.sh

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ISSUER="${D5_PLATFORM_OIDC_ISSUER:-}"
if [[ -n "${ISSUER}" ]]; then
  KC="$(python3 -c 'import sys; print(sys.argv[1].split("/realms/")[0].rstrip("/"))' "${ISSUER}")"
else
  KC="${KEYCLOAK_URL:-http://127.0.0.1:8080}"
fi
ADMIN="${KEYCLOAK_ADMIN:-admin}"
PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
REALM=ticket
FLOW_ALIAS="vemoki otp browser"

echo "target Keycloak: ${KC}"

export KC ADMIN PASS REALM FLOW_ALIAS ROOT
python3 <<'PY'
import json, urllib.request, urllib.error, urllib.parse, os, sys

kc = os.environ["KC"]
admin = os.environ["ADMIN"]
password = os.environ["PASS"]
realm = os.environ["REALM"]
flow = os.environ["FLOW_ALIAS"]
root = os.environ["ROOT"]

def http(method, path, data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = None if data is None else json.dumps(data).encode()
    req = urllib.request.Request(kc + path, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return resp.status, raw
    except urllib.error.HTTPError as e:
        return e.code, e.read()

# admin token
st, raw = http(
    "POST",
    "/realms/master/protocol/openid-connect/token",
    None,
)
# form-encoded token request
import urllib.parse as up
tok_body = up.urlencode({
    "grant_type": "password",
    "client_id": "admin-cli",
    "username": admin,
    "password": password,
}).encode()
req = urllib.request.Request(
    kc + "/realms/master/protocol/openid-connect/token",
    data=tok_body,
    headers={"Content-Type": "application/x-www-form-urlencoded"},
    method="POST",
)
with urllib.request.urlopen(req) as resp:
    token = json.loads(resp.read().decode())["access_token"]

def api(method, path, data=None):
    return http(method, path, data, token=token)

realm_json = json.loads(open(f"{root}/infra/keycloak/realm-ticket.json").read())
want = {"ticket-platform-api", "ticket-platform-web", "ticket-admin-web"}

def client_id(cid):
    st, raw = api("GET", f"/admin/realms/{realm}/clients?clientId={up.quote(cid)}")
    arr = json.loads(raw.decode() or "[]")
    return arr[0]["id"] if arr else None

for c in realm_json["clients"]:
    if c["clientId"] not in want:
        continue
    payload = {k: v for k, v in c.items() if k != "authenticationFlowBindingOverrides"}
    existing = client_id(c["clientId"])
    if existing:
        # Minimal update — do not round-trip secret/access if avoidable
        st, raw = api("GET", f"/admin/realms/{realm}/clients/{existing}")
        rep = json.loads(raw.decode())
        for k in (
            "name", "description", "redirectUris", "webOrigins", "attributes",
            "standardFlowEnabled", "directAccessGrantsEnabled", "publicClient",
            "protocol", "enabled",
        ):
            if k in payload:
                rep[k] = payload[k]
        # Replace protocol mappers by name if missing
        have = {m.get("name") for m in rep.get("protocolMappers") or []}
        for m in payload.get("protocolMappers") or []:
            if m.get("name") not in have:
                rep.setdefault("protocolMappers", []).append(m)
        rep["directAccessGrantsEnabled"] = False
        st, raw = api("PUT", f"/admin/realms/{realm}/clients/{existing}", rep)
        print(f"updated {c['clientId']} http={st}")
        if st >= 400:
            print(raw.decode()[:300], file=sys.stderr)
            sys.exit(1)
    else:
        st, raw = api("POST", f"/admin/realms/{realm}/clients", payload)
        print(f"created {c['clientId']} http={st}")
        if st >= 400:
            print(raw.decode()[:300], file=sys.stderr)
            sys.exit(1)

# Copy browser flow
st, raw = api("GET", f"/admin/realms/{realm}/authentication/flows")
flows = json.loads(raw.decode())
if not any(f.get("alias") == flow for f in flows):
    st, raw = api("POST", f"/admin/realms/{realm}/authentication/flows/browser/copy", {"newName": flow})
    print(f"copied browser → {flow} http={st}")
    if st >= 400:
        print(raw.decode()[:300], file=sys.stderr)
        sys.exit(1)
else:
    print(f"flow exists: {flow}")

# Force MFA: raise Conditional OTP subflow to REQUIRED (always OTP), and OTP Form REQUIRED.
# Keycloak flat executions list uses displayName (flowAlias often null on top-level copy).
flow_enc = up.quote(flow)
st, raw = api("GET", f"/admin/realms/{realm}/authentication/flows/{flow_enc}/executions")
execs = json.loads(raw.decode())

# Keycloak 26 browser copy: top-level REQUIRED next to Cookie/IdP ALTERNATIVE makes the flow
# ignore the alternatives and fail before the login form (AuthenticationFlowException).
# Keep "forms" ALTERNATIVE and disable the unused "Organization" subflow.
for e in execs:
    if e.get("level") != 0 or not e.get("authenticationFlow"):
        continue
    disp_l = (e.get("displayName") or "").lower()
    want = None
    if disp_l.endswith(" forms"):
        want = "ALTERNATIVE"
    elif disp_l.endswith(" organization"):
        want = "DISABLED"
    if want and e.get("requirement") != want:
        e["requirement"] = want
        st3, raw3 = api(
            "PUT",
            f"/admin/realms/{realm}/authentication/flows/{flow_enc}/executions",
            e,
        )
        print(f"top-level {e.get('displayName')} → {want} http={st3}")
        if st3 >= 400:
            print(raw3.decode()[:300], file=sys.stderr)
            sys.exit(1)

updated = 0
for e in execs:
    disp = (e.get("displayName") or "")
    disp_l = disp.lower()
    # Parent Conditional OTP → REQUIRED (mandatory TOTP for platform/admin clients)
    if e.get("authenticationFlow") and "conditional otp" in disp_l:
        if e.get("requirement") != "REQUIRED":
            e["requirement"] = "REQUIRED"
            st3, raw3 = api(
                "PUT",
                f"/admin/realms/{realm}/authentication/flows/{flow_enc}/executions",
                e,
            )
            print(f"Conditional OTP → REQUIRED ({disp}) http={st3}")
            if st3 >= 400:
                print(raw3.decode()[:300], file=sys.stderr)
                sys.exit(1)
            updated += 1
    # OTP Form leaf → REQUIRED
    if (e.get("providerId") == "auth-otp-form") or ("otp form" in disp_l and not e.get("authenticationFlow")):
        if e.get("requirement") != "REQUIRED":
            e["requirement"] = "REQUIRED"
            st3, raw3 = api(
                "PUT",
                f"/admin/realms/{realm}/authentication/flows/{flow_enc}/executions",
                e,
            )
            print(f"OTP Form → REQUIRED ({disp}) http={st3}")
            if st3 >= 400:
                print(raw3.decode()[:300], file=sys.stderr)
                sys.exit(1)
            updated += 1
print(f"otp_form_updates={updated}")

# Keycloak expects flow UUID (not alias) in authenticationFlowBindingOverrides
st, raw = api("GET", f"/admin/realms/{realm}/authentication/flows")
flows = json.loads(raw.decode())
flow_id = next((f["id"] for f in flows if f.get("alias") == flow), None)
if not flow_id:
    print(f"flow id missing for {flow}", file=sys.stderr)
    sys.exit(1)
print(f"flow_id={flow_id}")

# Bind browser override using authenticationFlowBindingOverrides only
for cid in ("ticket-platform-web", "ticket-admin-web"):
    uuid = client_id(cid)
    if not uuid:
        print(f"missing {cid}", file=sys.stderr)
        sys.exit(1)
    st, raw = api("GET", f"/admin/realms/{realm}/clients/{uuid}")
    rep = json.loads(raw.decode())
    rep["authenticationFlowBindingOverrides"] = {"browser": flow_id}
    rep["directAccessGrantsEnabled"] = False
    # Drop fields that often cause 500 on PUT
    for drop in ("access", "secret"):
        rep.pop(drop, None)
    st, raw = api("PUT", f"/admin/realms/{realm}/clients/{uuid}", rep)
    print(f"bound {flow} ({flow_id}) → {cid} http={st}")
    if st >= 400:
        print(raw.decode()[:500], file=sys.stderr)
        sys.exit(1)

# Realm default scope "acr" (oidc-acr-mapper, LoA from session) overrides the client's
# hardcoded acr=2 claim with acr=1 — detach it from MFA clients.
st, raw = api("GET", f"/admin/realms/{realm}/client-scopes")
acr_scope = next((s["id"] for s in json.loads(raw.decode()) if s.get("name") == "acr"), None)
if acr_scope:
    for cid in ("ticket-platform-web", "ticket-admin-web"):
        uuid = client_id(cid)
        st, raw = api("DELETE", f"/admin/realms/{realm}/clients/{uuid}/default-client-scopes/{acr_scope}")
        print(f"detach default scope acr → {cid} http={st}")
        if st >= 400 and st != 404:
            print(raw.decode()[:300], file=sys.stderr)
            sys.exit(1)

# Clear binding on attendee ticket-web
uuid = client_id("ticket-web")
st, raw = api("GET", f"/admin/realms/{realm}/clients/{uuid}")
rep = json.loads(raw.decode())
overrides = dict(rep.get("authenticationFlowBindingOverrides") or {})
overrides.pop("browser", None)
if overrides:
    rep["authenticationFlowBindingOverrides"] = overrides
else:
    rep["authenticationFlowBindingOverrides"] = {}
rep.pop("access", None)
rep.pop("secret", None)
st, raw = api("PUT", f"/admin/realms/{realm}/clients/{uuid}", rep)
print(f"cleared otp binding on ticket-web http={st}")

for cid in ("ticket-platform-api", "ticket-platform-web", "ticket-admin-web"):
    if not client_id(cid):
        print(f"VERIFY FAIL {cid}", file=sys.stderr)
        sys.exit(1)
    print(f"verify ok {cid}")

print(f"PLATFORM_KEYCLOAK_APPLY_PASS kc={kc}")
PY
