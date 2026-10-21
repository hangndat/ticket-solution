# D12 — SMTP Keycloak + worker prod smoke (2026-10-21)

**Scope:** Ops + repo (không submit TestFlight / ASC). **Không** secrets trong git.

## Live Keycloak SMTP (VPS)

```text
kcadm get realms/ticket (smtpServer fields, password redacted by Keycloak):
  host=smtp.porkbun.com port=587 from=noreply@vemoki.com
  auth=true starttls=true ssl=false user=noreply@vemoki.com
```

Applied via node-parsed `SMTP_URL` from `/opt/vemoki/.env` (same Porkbun account as worker). Script: `scripts/keycloak-prod-smtp-apply.sh`.

## Email smoke → hangndat@gmail.com

| Path | Result |
| --- | --- |
| Keycloak `PUT …/users/{id}/execute-actions-email` `["UPDATE_PASSWORD"]` (client `ticket-web`, redirect `https://app.vemoki.com/api/auth/callback`) | **HTTP 204** |
| Worker `sendMailViaSmtp` (container `vemoki-worker-1`, subject `Vemoki worker SMTP smoke`) | **OK** (`providerRef` message-id returned) |

Inbox vs Spam: **not verified in this session** (no mailbox API); operator should confirm delivery in Gmail.

## DNS (dig, read-only)

| Record | Status |
| --- | --- |
| SPF `vemoki.com` TXT | `v=spf1 include:_spf.porkbun.com ~all` |
| DKIM `default._domainkey.vemoki.com` | RSA public key present |
| DMARC `_dmarc.vemoki.com` | `p=quarantine` + rua/ruf mailboxes |

## Repo

- `infra/keycloak/realm-ticket.prod.json` — import prod, **no** `smtpServer` (avoids Mailpit overwrite on recreate).
- `infra/keycloak/realm-ticket.json` — local dev Mailpit unchanged.
- `REALM_FILE=/opt/vemoki/realm-ticket.prod.json` in `infra/deploy/.env.example`.

## Operator follow-up

1. Copy prod realm: `cp infra/keycloak/realm-ticket.prod.json /opt/vemoki/realm-ticket.prod.json`; set `REALM_FILE` in `/opt/vemoki/.env` if still `realm-ticket.json`.
2. After Keycloak recreate: re-run `scripts/keycloak-prod-smtp-apply.sh`.
3. Optional: remove smoke user `hangndat@gmail.com` from realm if not needed long-term.
