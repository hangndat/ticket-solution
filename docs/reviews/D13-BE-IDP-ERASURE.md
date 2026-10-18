# D13 — BE SEC-2: xóa danh tính Keycloak + denylist đăng nhập lại

| Field | Value |
| --- | --- |
| Issue | #351 (Epic #301 → Story #305) |
| Role | `backend` (`docs/agents/roles/backend.md`) |
| Architecture impact | **Có** — auth identity + durable IdP erasure (handoff D13 §5) |
| Handoff | `docs/architecture/D13-ACCOUNT-DELETION-HANDOFF.md` @ `723d46dd218e10f988772509c0ca4a85cfca8929` + R2 `6247455038` |
| Exact SHA (behavior) | `0533cb1385ba47d9d5c255438a01c3f8c7925ae8` |
| Ownership | `packages/backend`, `apps/api` (verifier + identity upsert gate), `apps/worker` |
| Related | ACK PR #352 tip `e12d68e7…` **chưa** trên main — SEC-2 branch từ `origin/main`; coordinator integrate ACK rồi reconcile |
| Ordering note | Không giả ACK đã merge; apply-path SEC-1 (#348) vẫn revoke sessions trong PG scrub |

## Mục tiêu

COMPLETED **chỉ** khi `pg_applied_at` + `idp_status ∈ {DELETED, NOT_FOUND}`. Không COMPLETED vì PG-only / disable / config 404. Fail-closed JWT (max 24h+5m) + upsert denylist HMAC 48h.

## Fix (tóm tắt)

Migration `202610180004_d13_sec2_idp_erasure`:

- Cột internal trên `account_deletion_requests` (không đổi public state enum)
- `apply_account_anonymization` → PG scrub + `pg_applied_at` only (stay `REQUESTED`)
- Lease / finalize / mark attempt / purge / snapshot / open-identity helpers (SECURITY DEFINER)

TS:

- `keycloak-erasure.ts` — Admin GET/DELETE by UUID `sub`; no username/email fallback
- `tombstone-keyring.ts` — HMAC-SHA256 canonical JSON `[issuer,sub]`
- `account-deletion.ts` — `processDueAccountAnonymizations(env, lease, idp?)` full pipeline
- `oidc.ts` / `platform-oidc.ts` — `maxTokenAge` 24h + `clockTolerance` 300 + `exp−iat` bound
- `users.ts` + API — `assertIdentityAllowedForUpsert` (open request / digest)
- Worker — pass `env` + `leaseOwner`

## Env (coordinator root — confirmed)

| Key | Notes |
| --- | --- |
| `KEYCLOAK_BASE_URL` | Trusted Admin base |
| `KEYCLOAK_REALM` | Fixed realm (e.g. `ticket`) |
| `KEYCLOAK_ERASURE_CLIENT_ID` / `SECRET` | Worker-only |
| `KEYCLOAK_ERASURE_ENABLED` | default unset/0 → fail-closed IdP, **no** PG-only COMPLETED |
| `ACCOUNT_DELETION_TOMBSTONE_KEYRING_JSON` | `[{keyId,secretBase64}]` ≥32B secrets |
| `ACCOUNT_DELETION_TOMBSTONE_CURRENT_KEY_ID` | Must exist in ring; shared API+worker |
| `OIDC_ISSUER` | Exact allowlist entry for snapshot/IdP |

### Compose / ops needs (coordinator)

1. Provision Keycloak client `vemoki-erasure` (delete/view-users; not realm-admin); inject secret only into **worker** service env.
2. Mount keyring JSON + current key id on **api + worker**.
3. Evidence realm `accessTokenLifespan` (and client overrides) **≤ 24h** before prod enable.
4. Do **not** enable `KEYCLOAK_ERASURE_ENABLED=1` in prod until ops gate + SEC-1 ACK merge reconciled.

## Checks

```text
pnpm --filter @ticket/contracts build && pnpm --filter @ticket/backend build
cd packages/backend && node --test \
  test/account-idp-erasure.test.cjs \
  test/account-session-revoke.test.cjs \
  test/oidc.test.cjs
→ account-idp-erasure + session-revoke + oidc: pass
```

Covered: T4 DELETE+COMPLETED+scrub originals; T5 NOT_FOUND; T6 PATH_404; T7 disable non-terminal; T8 503→DELETE; T9 upsert deny; T11 no double-complete panic; T12/T13 no fuzzy / issuer allowlist; missing IdP → PG apply without COMPLETED; T16 lifetime>24h; T17 purge then upsert; SEC-1 regression with fake IdP.

## Limitations

- Live Keycloak Admin DELETE fixture **chưa** chạy trong PR (erasure client/secrets = ops blocker). Fake adapter covers fault matrix; local realm `http://127.0.0.1:8080/realms/ticket` probed HTTP 200 only.
- ACK revoke-at-request (#352) chưa trên main — integrate rồi revalidate full SHA.
- Root `.env.example` / compose / CI wiring = coordinator (worker không sửa).
- Không merge / deploy prod trong worker này.
