# D13 — PR #357 DoD + security review (SEC-2 IdP erasure)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca worker `term_59338f7d-b487-4129-8d89-7e67dab9c4b9` · Roles `reviewer-dod` + `reviewer-security` (`docs/agents/roles/reviewer-dod.md`, `reviewer-security.md`) · agent cursor · **≠** implementer |
| Scope | Issue **#351** · PR **#357** · ownership BE: `packages/backend`, `apps/api` (verifier/identity gate), `apps/worker` + coordinator CI/env compose on tip |
| Epic / Story | Epic #301 → Story #305 |
| Architecture impact | **Có** — identity erasure / auth bounds / HMAC denylist / keyring / SQL lease (handoff R1–R5) |
| Commit SHA (exact tip đã duyệt) | `a0eb3cb15c3c9c6e216ae499a72083fd269d9cb6` |
| Live GitHub API head | `a0eb3cb15c3c9c6e216ae499a72083fd269d9cb6` (khớp) |
| Behavior commit (ancestor) | `ff0800eaa24bc77a05acfe2ed7eb403f2c30b552` |
| Prior tip trước main-sync+CI | `7213949c36b8ef6259d883f080b61b87920681b7` |
| Handoff / ADR | `docs/architecture/D13-ACCOUNT-DELETION-HANDOFF.md` @ merge `723d46dd…` (+ R1–R5) |
| Verdict DoD | **FAIL** |
| Verdict Security | **FAIL** |

## SHA / tích hợp (đã reconcile)

- Dispatch ban đầu ghi `fd498198…` — SHA đó chỉ nằm trên `hangndat/d13-be-session-revoke` (CI line only) và **không** chứa SEC-2; đã escalate.
- Coordinator xác nhận lỗi root worktree; push đúng head PR #357 = `a0eb3cb…` (behavior `ff0800e` + merge main/#355 config + CI `account-idp-erasure.test.cjs`).
- Review này **chỉ** nghiệm thu exact SHA `a0eb3cb15c3c9c6e216ae499a72083fd269d9cb6`. **Không** dùng `fd49819`.

## Tóm tắt

Pipeline SEC-2 đúng hướng handoff: `COMPLETED` chỉ khi `pg_applied_at` + `idp_status ∈ {DELETED,NOT_FOUND}`; lease/finalize fenced; PATH_404 ≠ user absence; OIDC ≤24h+5m; fake-adapter T4–T17 xanh trên isolated PG; CI shard `account-deletion` trên tip đã pass. **Blocker:** `assertIdentityAllowedForUpsert` **fail-open** khi keyring thiếu/invalid sau khi open-request check qua — vi phạm AC fail-closed + R3; compose default keyring rỗng làm denylist API không hiệu lực sau `COMPLETED`.

## Diff ownership (tip `a0eb3cb`)

**Behavior (`ff0800e`…`7213949`):**

- `packages/backend/src/{keycloak-erasure,tombstone-keyring,access-token-bounds,account-deletion,oidc,platform-oidc,users,index}.ts`
- `packages/backend/prisma/migrations/202610180004_d13_sec2_idp_erasure/migration.sql`
- `packages/backend/test/account-idp-erasure.test.cjs` (+ session-revoke / platform adjustments)
- `apps/api/src/{app,platform}.ts`, `apps/worker/src/index.ts`
- `docs/reviews/D13-BE-IDP-ERASURE.md`

**Coordinator tip delta (`7213949`→`a0eb3cb`):**

- `.github/workflows/ci.yml` — shard account-deletion thêm `test/account-idp-erasure.test.cjs`
- `.env.example`, `apps/api|worker/.env.example`, `infra/deploy/{compose.yaml,.env.example}`, `docs/reviews/D13-RUNTIME-ERASURE-CONFIG.md` (từ #355 + cherry-pick CI)

## Checklist DoD / AC (#351)

| AC | Kết quả |
| --- | --- |
| COMPLETED iff PG scrub + IdP DELETE/NOT_FOUND | **Pass** — finalize SQL + TS; missing IdP → REQUESTED + `IDP_MISCONFIGURED` |
| Disable / PATH_404 không COMPLETED | **Pass** — T6/T7 |
| Lease stale fenced; multi-worker | **Pass** — claim/finalize owner+TTL; T11 no double complete |
| Issuer allowlist + sub UUID; no fuzzy email/username | **Pass** — adapter + T12/T13 |
| HTTP semantics 204/confirmed 404 vs realm/config 404 | **Pass** — token 404→`IDP_PATH_404`; GET/DELETE user 404→`NOT_FOUND` sau token OK |
| OIDC max access 24h + 5m; require iat/exp | **Pass** — `jose` maxTokenAge/clockTolerance + `assertAccessTokenBounds`; T16 |
| Upsert deny open request / unexpired digest | **Pass** khi keyring có mặt — T9/T17 |
| Missing IdP/keyring config fail-closed | **Fail** — worker thiếu keyring: không COMPLETED (**OK**); **API upsert** thiếu/invalid keyring: `return` sau alert → **cho phép upsert** post-COMPLETED (**blocker**) |
| Current/old key dual-accept; purge privacy; scrub originals | **Pass** — `digestsForIdentity`; purge clears digest; finalize nulls originals |
| RLS / runtime no owner; SECURITY DEFINER | **Pass** — DEFINER + `REVOKE PUBLIC` + `GRANT ticket_runtime`; `account_deletion_requests` trong DEFINER_OWNER_TABLES |
| Fake adapter ≠ live Keycloak | **Known gap** — không evidence live DELETE; không claim integration IdP thật |
| CI suite trên final SHA | **Pass** — Actions run `39111325610` head `a0eb3cb`; shard account-deletion **pass** (gồm idp-erasure) |
| ACK PR #352 | **ACK riêng** — còn OPEN `e12d68e7…`; **không** giả đã integrate; cần reconcile sau merge |
| Security release gate #320 | **Còn mở** đến khi có live E2E evidence |

## Security review

### Threat / abuse đã xét

1. **PG-only COMPLETED** — FIXED (finalize requires terminal IdP + lease fence).
2. **Config/realm 404 → false NOT_FOUND** — FIXED (token path 404 = PATH_404).
3. **Concurrent workers double DELETE / race finalize** — lease owner + expire fence; T11.
4. **Issuer/sub spoof / fuzzy delete** — allowlist + UUID only.
5. **Stale JWT / re-upsert after delete** — open request + HMAC digest 48h — **broken under missing API keyring** (below).
6. **Erasure secret on API** — compose: Admin secret **worker-only**; API chỉ tombstone keyring — **Pass**.
7. **Default empty keyring in compose** (`:-[]` + empty current id) → API denylist path fail-open — **Fail**.
8. **Runtime table owner / RLS bypass** — DEFINER pattern; runtime role not owner — **Pass**.
9. **Secrets in git** — placeholders only — **Pass**.

### Blocker (fix trước merge)

**B1 — API denylist fail-open khi keyring thiếu/invalid**

`assertIdentityAllowedForUpsert` (`packages/backend/src/account-deletion.ts`): sau khi open-request check, `readTombstoneKeyring` lỗi `TombstoneKeyringError` → log alert rồi **`return`** (cho phép upsert). Post-`COMPLETED`, originals đã scrub → open check không chặn → **recreate cùng `(issuer,sub)` trong cửa sổ 48h nếu API thiếu keyring**.

Handoff R3 + `.env.example` ghi fail-closed; compose default keyring rỗng làm path này thành default misconfig.

**Fix mong đợi:** thiếu/invalid keyring trên API → throw `UNAUTHENTICATED` (hoặc hard fail process boot), không `return`; thêm regression test. Worker path giữ mark `FAILED` / không COMPLETED.

### Should-fix / gaps (không thay B1)

| ID | Ghi chú |
| --- | --- |
| G1 | Không có live Keycloak Admin DELETE fixture — fake adapter only; **#320** / release gate giữ |
| G2 | PR **#352** ACK revoke-at-request chưa merge — reconcile ordering sau integrate; revalidate full SHA |
| G3 | `account_deletion_tombstone_blocks(p_issuer,…)` không filter issuer cột (HMAC đã gắn issuer) — nit |
| G4 | Ops: provision `vemoki-erasure` + realm accessTokenLifespan ≤24h evidence trước `KEYCLOAK_ERASURE_ENABLED=1` |

### Đối chiếu handoff R1–R5

| Handoff | Tip `a0eb3cb` |
| --- | --- |
| R1 TTL 48h; access ≤24h+5m | Khớp |
| R2 internal flags; no public enum | Khớp |
| R3 keyring shared API+worker; missing fail-closed | Worker OK; **API upsert lệch → B1** |
| R4 HMAC canonical `[issuer,sub]` | Khớp |
| R5 REJECTED không restore session | SEC-1 apply path; ACK #352 riêng |

## Checks (exact SHA `a0eb3cb`)

```text
# Local (detached worktree @ a0eb3cb), isolated Docker PG per test:
pnpm --filter @ticket/contracts build && pnpm --filter @ticket/backend build
cd packages/backend && node --test \
  test/account-idp-erasure.test.cjs \
  test/account-session-revoke.test.cjs \
  test/oidc.test.cjs
→ 10 pass / 0 fail (EXIT 0); containers cleaned

# GitHub Actions (headSha a0eb3cb):
https://github.com/hangndat/ticket-solution/actions/runs/39111325610
→ conclusion success; database-isolation account-deletion shard pass (includes account-idp-erasure.test.cjs)
```

## Limitations

- Reviewer không sửa code / không merge / không đổi Project Status.
- Không chạy live Keycloak DELETE.
- Artifact này sống trên worktree review; tip PR chưa chứa file này cho đến khi coordinator commit.

## Verdict

**DoD: FAIL** · **Security: FAIL** — vì B1 (fail-open denylist API). Phần còn lại của SEC-2 behavior + CI trên `a0eb3cb` đạt; sau fix B1 cần **revalidate exact SHA mới**. G1/G2/#320 vẫn là known gaps không đủ để PASS một mình.
