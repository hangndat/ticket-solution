# PR #844 — Platform Operator mutate (portal)

| Field | Value |
| --- | --- |
| Issue | [#844](https://github.com/hangndat/ticket-solution/issues/844) |
| PR | [#850](https://github.com/hangndat/ticket-solution/pull/850) |
| Branch | `hangndat/portal-844-platform-mutate` |
| Evidence SHA (code under test) | `0172cebe0ac01780d36416eaaff0e125de9719e7` |
| Merge base (post `origin/main`, incl. Keycloak dev #851) | `b83702999b4cb4a81d5e26ec15ef10ae19a76517` |
| UAT run | 2026-10-23 — worker `task_07ec66a02df2` (evidence re-run, **không** lượt sửa 1/2) |

## Parity (G-791-2/3) — `apps/web` → `apps/portal`

| Action | Web BFF | Portal BFF (this PR) | Portal UI |
| --- | --- | --- | --- |
| POST tenant provision | `POST /api/bff/platform/tenants` | `POST /api/bff/platform/tenants` | Tab **Provision** |
| GET tenant detail | `GET …/tenants/[tenantId]` | `GET …/tenants/[tenantId]` | Tab **Manage** |
| POST suspend/activate | `POST …/status` | `POST …/status` | **Manage** + `Modal.confirm` |
| PUT limits/flags | `PUT …/limits` | `PUT …/limits` | **Manage** form |
| POST support grant create | `POST /api/bff/platform/support-grants` | `POST …/support-grants` | Tab **Grant create** + `Modal.confirm` (F01) |
| GET tenants list (existing) | GET | GET | Tab **Tenants** |
| Revoke grant (portal-only) | — | POST `…/revoke` | Tab **Revoke** |

## Keycloak / MFA (stack `pr844-uat`)

```bash
COMPOSE_PROJECT_NAME=pr844-uat docker compose up -d postgres redis keycloak
D5_PLATFORM_OIDC_ISSUER=http://127.0.0.1:8080/realms/ticket ./scripts/platform-keycloak-apply-realm.sh
D5_PLATFORM_OIDC_ISSUER=http://127.0.0.1:8080/realms/ticket node scripts/lib/platform-keycloak-mfa-live-proof.mjs
```

| Check | Kết quả |
| --- | --- |
| `PLATFORM_KEYCLOAK_APPLY_PASS` | **PASS** (`kc=http://127.0.0.1:8080`) |
| `PLATFORM_MFA_LIVE_PROOF_PASS` | **PASS** `acr=2` `aud` includes `ticket-platform-api` (token không log) |

## UAT Operator (local)

```bash
FE_UAT_STATE_DIR=.fe-uat-stack-pr844 ./scripts/fe-uat-stack.sh bootstrap
# bootstrap_platform_operator(<staff user id from seed>)
# API :3001, portal :3013 (next start), WEB_UAT_CHANNEL=chrome
node apps/portal/scripts/pr844-platform-uat.mjs
```

| Hạng mục | Kết quả |
| --- | --- |
| Login `/platform` với `acr=2` (OTP enroll + cửa sổ TOTP) | **PASS** |
| Screenshots mutate @1280 + @390 (provision, detail, suspend, activate, limits, grant create) | **PASS** — `docs/reviews/assets/PR844/` |
| Axe serious/critical (mutate panels, reducedMotion) | **0** |
| `PR844_UAT_OK` | **PASS** — 12 shots |

### Ảnh (prefix SHA `0172cebe0ac0`)

| File | md5 |
| --- | --- |
| `0172cebe0ac0-provision-1280.png` | `0b89c2ef052173ab75849dc3a856ca52` |
| `0172cebe0ac0-provision-390.png` | `3a6eecf9575a652d491c3a3af0a8ebdc` |
| `0172cebe0ac0-manage-detail-1280.png` | `b0b720649c69043d8278d1ba6e060f46` |
| `0172cebe0ac0-manage-detail-390.png` | `2c3428867fa25db483c206b523cc68fa` |
| `0172cebe0ac0-suspend-1280.png` | `3844eae738940ddc76f77776894580f3` |
| `0172cebe0ac0-suspend-390.png` | `08d2f1aac7137e59417f26522a87bc3a` |
| `0172cebe0ac0-activate-1280.png` | `0d4e4072ea4bcc53d589c6d988373ecc` |
| `0172cebe0ac0-activate-390.png` | `72d96af5c3b51e28d421713211831957` |
| `0172cebe0ac0-limits-1280.png` | `fa5e670915cf241b2f156a7929e903de` |
| `0172cebe0ac0-limits-390.png` | `a55653df6ee3697430539a9517280a58` |
| `0172cebe0ac0-grant-create-1280.png` | `f47bd03d1bee82512cb1abfcf47902f3` |
| `0172cebe0ac0-grant-create-390.png` | `1d03e54795ea464b0c1338f3fdaef429` |

Tất cả 12 md5 **khác nhau** (cặp 1280/390 khác nhau theo viewport).

## Lượt sửa 1/2 (giữ nguyên bộ đếm)

| Hạng mục | Trạng thái |
| --- | --- |
| F01–F03 (code + unit tests) | Đã land trước run này |
| UAT evidence sau Keycloak #851 | **PASS** trên SHA `0172cebe0ac0` |

## Ghi chú evidence run

- Stack riêng `COMPOSE_PROJECT_NAME=pr844-uat` (volume mới); không dùng `portal-fix-838`.
- Fixture DB: seed `tenant_limits` cho D9 demo tenant trước UAT (demo seed không tạo row limits).
- Sửa nhỏ kèm evidence commit `0172ceb`: shell nhận `platform_oidc` khi staff `me` 401; contrast tiêu đề mutate; harness UAT (tab mobile, axe scope).
