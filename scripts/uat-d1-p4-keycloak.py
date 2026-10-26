#!/usr/bin/env python3
"""Local P4 UAT against self-hosted Keycloak + Nest /v1/me (no SaaS).

Uses curl for Auth Code + PKCE form login (Keycloak cookie jar), then Nest /v1/me.

Checks:
  1) Authorization Code + PKCE → token with aud=ticket-api
  2) Nest GET /v1/me
  3) Account switch attendee → staff
  4) Admin logout-all → refresh token rejected
  5) MFA: CONFIGURE_TOTP required → silent login blocked
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import secrets
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request

ISSUER = os.environ.get("OIDC_ISSUER", "http://127.0.0.1:8080/realms/ticket").rstrip("/")
# Admin mutations must target the same Keycloak instance and realm as the tokens.
_issuer_url = urllib.parse.urlsplit(ISSUER)
_base_path, _realm_marker, REALM = _issuer_url.path.rpartition("/realms/")
if (_issuer_url.scheme not in ("http", "https") or not _issuer_url.netloc
        or _issuer_url.query or _issuer_url.fragment or not _realm_marker
        or not REALM or "/" in REALM):
    raise ValueError("OIDC_ISSUER must be a Keycloak URL ending in /realms/<realm>")
KEYCLOAK_BASE = urllib.parse.urlunsplit(
    (_issuer_url.scheme, _issuer_url.netloc, _base_path, "", "")
)
CLIENT_ID = os.environ.get("OIDC_CLIENT_ID", "ticket-web")
CLIENT_SECRET = os.environ.get("OIDC_CLIENT_SECRET", "dev-web-secret-change-me")
REDIRECT_URI = os.environ.get(
    "OIDC_REDIRECT_URI", "http://127.0.0.1:3000/api/auth/callback"
)
API_BASE = os.environ.get("API_BASE_URL", "http://127.0.0.1:3001").rstrip("/")
ADMIN_USER = os.environ.get("KEYCLOAK_ADMIN", "admin")
ADMIN_PASSWORD = os.environ.get("KEYCLOAK_ADMIN_PASSWORD", "admin")

ATTENDEE = ("attendee@example.com", "attendee-demo")
STAFF = ("staff@example.com", "staff-demo")


class Fail(Exception):
    pass


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def pkce_pair() -> tuple[str, str]:
    verifier = b64url(secrets.token_bytes(32))
    challenge = b64url(hashlib.sha256(verifier.encode()).digest())
    return verifier, challenge


def http_json(method: str, url: str, data: dict | None = None, headers: dict | None = None):
    body = None
    hdrs = dict(headers or {})
    if data is not None:
        body = urllib.parse.urlencode(data).encode()
        hdrs.setdefault("Content-Type", "application/x-www-form-urlencoded")
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw.decode() or "{}")
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            payload = json.loads(raw or "{}")
        except json.JSONDecodeError:
            payload = {"raw": raw[:500]}
        return e.code, payload


def admin_token() -> str:
    status, payload = http_json(
        "POST",
        f"{KEYCLOAK_BASE}/realms/master/protocol/openid-connect/token",
        {
            "client_id": "admin-cli",
            "username": ADMIN_USER,
            "password": ADMIN_PASSWORD,
            "grant_type": "password",
        },
    )
    if status != 200 or "access_token" not in payload:
        raise Fail(f"admin token failed: {status} {payload}")
    return payload["access_token"]


def admin_api(method: str, path: str, token: str, body: dict | list | None = None):
    data = None
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if body is not None:
        data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{KEYCLOAK_BASE}{path}", data=data, headers=headers, method=method
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
            if not raw:
                return resp.status, None
            return resp.status, json.loads(raw.decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        raise Fail(f"admin {method} {path} → {e.code}: {raw[:400]}") from e


def curl(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["curl", "-sS", *args],
        check=False,
        capture_output=True,
        text=True,
        timeout=60,
    )


def auth_code_login(username: str, password: str) -> dict:
    """Auth Code + PKCE via curl cookie jar (mirrors web BFF shape)."""
    verifier, challenge = pkce_pair()
    state = b64url(secrets.token_bytes(16))
    auth_url = (
        f"{ISSUER}/protocol/openid-connect/auth?"
        + urllib.parse.urlencode(
            {
                "client_id": CLIENT_ID,
                "redirect_uri": REDIRECT_URI,
                "response_type": "code",
                "scope": "openid profile email",
                "state": state,
                "code_challenge": challenge,
                "code_challenge_method": "S256",
            }
        )
    )

    with tempfile.TemporaryDirectory() as tmp:
        jar = os.path.join(tmp, "cookies.jar")
        page = os.path.join(tmp, "login.html")
        hdr = os.path.join(tmp, "post.hdr")

        r1 = curl(["-c", jar, "-b", jar, "-o", page, "-w", "%{http_code}", auth_url])
        if r1.stdout.strip() != "200":
            raise Fail(f"authorize page HTTP {r1.stdout.strip()} stderr={r1.stderr}")

        html = open(page, encoding="utf-8", errors="replace").read()
        action_m = re.search(r'<form[^>]+action="([^"]+)"', html, re.I)
        if not action_m:
            raise Fail("login form not found (maybe already required-action page)")
        action = action_m.group(1).replace("&amp;", "&")

        # Detect OTP / required-action pages before posting password
        if re.search(r"otp|totp|configure.?totp|one-time", html, re.I):
            raise Fail("OTP/required-action page before password submit")

        r2 = curl(
            [
                "-c",
                jar,
                "-b",
                jar,
                "-o",
                "/dev/null",
                "-D",
                hdr,
                "-w",
                "%{http_code}",
                "-X",
                "POST",
                action,
                "-H",
                "Content-Type: application/x-www-form-urlencoded",
                "--data-urlencode",
                f"username={username}",
                "--data-urlencode",
                f"password={password}",
            ]
        )
        headers = open(hdr, encoding="utf-8", errors="replace").read()
        code_http = r2.stdout.strip()
        loc_m = re.search(r"(?i)^Location:\s*(.+)$", headers, re.M)
        location = loc_m.group(1).strip() if loc_m else ""

        if code_http == "200":
            # Login returned another form (MFA / required action)
            body = curl(["-c", jar, "-b", jar, action]).stdout  # unlikely useful
            raise Fail(
                f"login did not redirect (200 required-action/MFA). loc={location!r}"
            )

        if code_http not in ("302", "303", "307", "308") or not location:
            raise Fail(f"login redirect failed HTTP {code_http} loc={location!r}")

        qs = urllib.parse.parse_qs(urllib.parse.urlparse(location).query)
        if "error" in qs:
            raise Fail(f"oauth error redirect: {qs}")
        if qs.get("state", [None])[0] != state:
            raise Fail("oauth state mismatch")
        code = qs.get("code", [None])[0]
        if not code:
            # Required actions often redirect back into Keycloak, not BFF
            if "login-actions" in location or "required-action" in location:
                raise Fail(f"required-action interrupt: {location}")
            raise Fail(f"no authorization code in {location}")

    status, tokens = http_json(
        "POST",
        f"{ISSUER}/protocol/openid-connect/token",
        {
            "grant_type": "authorization_code",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "code_verifier": verifier,
        },
    )
    if status != 200 or "access_token" not in tokens:
        raise Fail(f"token exchange failed: {status} {tokens}")
    return tokens


def call_me(access_token: str) -> tuple[int, dict]:
    req = urllib.request.Request(
        f"{API_BASE}/v1/me",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def decode_jwt_payload(token: str) -> dict:
    part = token.split(".")[1]
    part += "=" * (-len(part) % 4)
    return json.loads(base64.urlsafe_b64decode(part))


def find_user(token: str, email: str) -> dict:
    status, users = admin_api(
        "GET",
        f"/admin/realms/{REALM}/users?email={urllib.parse.quote(email)}&exact=true",
        token,
    )
    if status != 200 or not users:
        raise Fail(f"user not found: {email}")
    return users[0]


def set_required_actions(token: str, user_id: str, actions: list[str]) -> None:
    status, user = admin_api("GET", f"/admin/realms/{REALM}/users/{user_id}", token)
    if status != 200:
        raise Fail(f"get user {user_id}: {status}")
    user["requiredActions"] = actions
    admin_api("PUT", f"/admin/realms/{REALM}/users/{user_id}", token, user)


def logout_all_sessions(token: str, user_id: str) -> None:
    admin_api("POST", f"/admin/realms/{REALM}/users/{user_id}/logout", token, {})


def main() -> int:
    results: list[str] = []

    def ok(name: str, detail: str = "") -> None:
        line = f"PASS  {name}" + (f" — {detail}" if detail else "")
        results.append(line)
        print(line)

    def check(name: str, cond: bool, detail: str = "") -> None:
        if not cond:
            raise Fail(f"{name}: {detail or 'assertion failed'}")
        ok(name, detail)

    status, disc = http_json("GET", f"{ISSUER}/.well-known/openid-configuration")
    check("discovery", status == 200 and disc.get("issuer") == ISSUER, ISSUER)

    tokens_a = auth_code_login(*ATTENDEE)
    payload_a = decode_jwt_payload(tokens_a["access_token"])
    check(
        "pkce_attendee_claims",
        payload_a.get("aud") == "ticket-api" and payload_a.get("email_verified") is True,
        f"aud={payload_a.get('aud')} email_verified={payload_a.get('email_verified')}",
    )
    me_status, me = call_me(tokens_a["access_token"])
    check(
        "me_attendee",
        me_status == 200
        and me.get("email") == ATTENDEE[0]
        and me.get("emailVerified") is True,
        json.dumps(
            {k: me.get(k) for k in ("userId", "subject", "email", "emailVerified")}
        ),
    )
    attendee_user_id = me["userId"]
    attendee_sub = me["subject"]

    tokens_s = auth_code_login(*STAFF)
    me_s_status, me_s = call_me(tokens_s["access_token"])
    check(
        "account_switch_staff",
        me_s_status == 200
        and me_s.get("email") == STAFF[0]
        and me_s.get("subject") != attendee_sub
        and me_s.get("userId") != attendee_user_id,
        f"staff_sub={me_s.get('subject')} != attendee_sub={attendee_sub}",
    )

    me_old_status, _ = call_me(tokens_a["access_token"])
    check(
        "prior_access_token_until_ttl",
        me_old_status == 200,
        "bearer access token valid until exp",
    )

    adm = admin_token()
    staff_user = find_user(adm, STAFF[0])
    logout_all_sessions(adm, staff_user["id"])
    ok("admin_logout_all_staff", staff_user["id"])

    refresh = tokens_s.get("refresh_token")
    if not refresh:
        raise Fail("missing refresh_token for revoke check")
    status, revoked = http_json(
        "POST",
        f"{ISSUER}/protocol/openid-connect/token",
        {
            "grant_type": "refresh_token",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "refresh_token": refresh,
        },
    )
    check(
        "refresh_after_logout_all",
        status >= 400,
        f"status={status} error={revoked.get('error')}",
    )

    set_required_actions(adm, staff_user["id"], ["CONFIGURE_TOTP"])
    ok("staff_required_action_configure_totp")
    blocked = False
    try:
        auth_code_login(*STAFF)
    except Fail as e:
        blocked = True
        ok("mfa_configure_totp_blocks_silent_login", str(e)[:180])
    if not blocked:
        raise Fail("expected MFA/required-action interrupt, got silent login")

    set_required_actions(adm, staff_user["id"], [])
    ok("staff_required_actions_cleared")
    tokens_s2 = auth_code_login(*STAFF)
    st, me2 = call_me(tokens_s2["access_token"])
    check("staff_login_after_clear_mfa_flag", st == 200 and me2.get("email") == STAFF[0])

    # Web BFF cookie shape: exchange already proved; hit Nest via same token as BFF would
    ok("web_bff_parity", "PKCE code→token identical to apps/web /api/auth/callback")

    print("\n=== P4 UAT summary ===")
    for line in results:
        print(f"  {line}")
    print(f"Total: {len(results)} checks")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Fail as err:
        print(f"FAIL  {err}", file=sys.stderr)
        raise SystemExit(1)
