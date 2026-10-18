# DoD + Security — PR #355 (D13 runtime erasure/SMTP config)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor DoD+security worker `term_dddd9ece-93db-466c-92ee-f95fb42a5d5e` · task `task_6e8f1c58cc3e` · dispatch `ctx_145147f32437` (≠ implementer) |
| Roles | `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` + `reviewer-security` · `docs/agents/roles/reviewer-security.md` · agent `cursor` (`orca-agent-routing.mdc`) |
| Scope | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · Tasks [#351](https://github.com/hangndat/ticket-solution/issues/351) / [#319](https://github.com/hangndat/ticket-solution/issues/319) · PR [#355](https://github.com/hangndat/ticket-solution/pull/355) · paths: `.env.example`, `apps/api/.env.example`, `apps/worker/.env.example`, `infra/deploy/.env.example`, `infra/deploy/compose.yaml`, `docs/reviews/D13-RUNTIME-ERASURE-CONFIG.md` |
| Architecture impact | **Có** — env / IdP credential boundary (Admin erasure secret worker-only; shared tombstone keyring API+worker). Đối chiếu handoff PR346 / `docs/architecture/D13-ACCOUNT-DELETION-HANDOFF.md` + contract Orca `msg_94399e50b65e`. |
| Commit SHA reviewed | `e4843876a28c471be11b08004f0656b5d3c22ac6` (`git rev-parse` + PR `headRefOid`) |
| Graph | `code-review-graph-ticket` `list_graph_stats_tool` + scoped `detect_changes_tool`; graph build SHA lagged worktree → **source + compose parse assertions thắng** |
| Verdict DoD | **PASS** |
| Verdict Security | **PASS** |

---

## Checklist vs Spec / AC

| AC | Result |
| --- | --- |
| Schema names = contract `msg_94399e50b65e`: `KEYCLOAK_BASE_URL` / `KEYCLOAK_REALM` / `KEYCLOAK_ERASURE_CLIENT_ID` / `KEYCLOAK_ERASURE_CLIENT_SECRET` / `KEYCLOAK_ERASURE_ENABLED` | **PASS** — root + deploy + worker examples; compose worker env |
| Shared `ACCOUNT_DELETION_TOMBSTONE_KEYRING_JSON` array `{keyId,secretBase64}` + `ACCOUNT_DELETION_TOMBSTONE_CURRENT_KEY_ID` | **PASS** — documented in examples; empty `[]` / empty current id defaults; API+worker compose both inject same vars |
| Erasure secret worker-only; API/web không nhận Admin secret | **PASS** — `apps/api/.env.example` không có `KEYCLOAK_ERASURE_*`; compose API chỉ keyring; web không có erasure keys |
| Empty / disabled defaults (`KEYCLOAK_ERASURE_ENABLED=0`, secret rỗng, keyring `[]`) | **PASS** |
| Issuer allowlist fixed (không parse issuer tùy ý từ env cho Admin) | **PASS** — compose cố định `OIDC_ISSUER: https://auth.vemoki.com/realms/ticket` cho API + worker; worker cũng nhận `KEYCLOAK_BASE_URL`/`REALM` ops-trusted |
| Keyring cùng schema API ↔ worker | **PASS** — in-memory equality sau `compose config` |
| Không commit secret thật | **PASS** — scan PR files: không PEM, không secretBase64 dài, `KEYCLOAK_ERASURE_CLIENT_SECRET=` rỗng |
| `SMTP_URL` env override; thiếu → Mailpit → gate #319 vẫn blocked | **PASS** — `SMTP_URL: ${SMTP_URL:-smtp://mailpit:1025}`; deploy `.env.example` không set `SMTP_URL`; override assert đạt; không pretend production mailer |
| Config ≠ evidence hành vi fail-closed / backend #351 | **PASS** — review note + PR body đúng; không đòi impl trong PR config |
| Không prod mutation / cloud | **PASS** — chỉ parse local compose + file review |

---

## Security (credential boundary)

Threat / abuse cases xét trong scope config:

1. **IdP Admin secret lộ sang API/web** — mitigations: secret chỉ trên worker compose + worker `.env.example`; API/web không map biến.
2. **Erasure bật nhầm trên deploy thiếu client** — default `KEYCLOAK_ERASURE_ENABLED:-0` + secret empty; docs yêu cầu giữ pending khi tắt (acceptance #351, chưa claim runtime).
3. **Keyring lệch API/worker → denylist fail-open/mint lệch** — cùng env names + cùng `${…}` inject; examples nhấn fail-closed khi thiếu key (impl #351).
4. **SMTP hardcode Mailpit che giấu thiếu mailer prod** — override từ env; default vẫn Mailpit → #319 **không** đóng bởi PR này.
5. **Secret trong Git** — placeholders only; không có credential thật trong diff.

Không yêu cầu WAF/IdP SaaS trái ADR. Không coi PASS config = live deletion E2E.

---

## Checks (exact SHA `e4843876a28c471be11b08004f0656b5d3c22ac6`)

```bash
git rev-parse HEAD
# → e4843876a28c471be11b08004f0656b5d3c22ac6

docker compose --env-file infra/deploy/.env.example \
  -f infra/deploy/compose.yaml config --quiet
# → rc 0

# In-memory assertions on `compose config --format json` (no resolved credentials printed):
# SMTP default mailpit when SMTP_URL absent; SMTP override applied when set;
# erasure enabled=0; worker secret empty; API/web lack erasure secret;
# keyring + current key id API==worker; OIDC_ISSUER API==worker;
# worker has full KEYCLOAK_* + keyring contract names.
# → ASSERT_PASS=15 ASSERT_FAIL=0

git diff --check e484387~1 e484387
# → clean
```

| Check | Result |
| --- | --- |
| Tip SHA = PR head | **match** |
| Compose parse quiet | **pass** |
| In-memory env assertions | **15/15 pass** (credentials not printed) |
| `git diff --check` | **clean** |
| CI on tip | [run 39110720404](https://github.com/hangndat/ticket-solution/actions/runs/39110720404) — `backend`/`ci`/`changes`/`d5-*`/`turbo-persist` **pass**; `web`/`mobile`/`database-isolation` skipped (config-only paths) |
| Secret scan PR files | **no findings** |

---

## Findings

### Residual nits (không chặn PASS)

1. **`docs/ops/ENV-MANIFEST.md`** — chưa liệt kê các biến D13 mới (examples/compose đã đủ cho PR này). Follow-up docs catalog tùy coordinator.
2. **Handoff logical vs wire** — handoff mô tả entry `{keyId, secret: bytes}`; env/contract dùng `secretBase64` (serialization). Comments example khớp contract `msg_94399e50b65e`; không phải drift schema tên biến.
3. **CRG worktree lag** — graph `built_at_sha` không khớp tip; kết luận từ source + compose assertions + CI.

### Out of scope / intentional non-claims

- Backend #351 fail-closed / pending-when-disabled **chưa** chứng minh bởi PR config.
- Không provision Keycloak client, không mint keyring thật, không deploy/bật erasure.
- Gate email production #319/#320 **vẫn mở** (Mailpit default).
- Không merge, không đổi Project Status (coordinator).

---

## Limitations

Đây là nghiệm thu **cấu hình / credential boundary** trên SHA tip. Không phải evidence runtime xóa danh tính live hay SMTP production đã hoạt động.
