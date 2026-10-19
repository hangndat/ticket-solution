# DoD — PR #540 portal self-serve onboarding PENDING + first-run (#521)

**Revalidation** — không kế thừa PASS từ `4449bcafe90e69a776407c8e89f6a3de1ee2297f`.

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Orca Cursor `reviewer-dod` · Persona James · terminal `term_679b613f-eeef-4487-860e-1e69089ccc7c` · task `task_58c2212a5005` · dispatch `ctx_d5cad3321332` · Run `run_d04055a8969b` · **≠** implementer (prior `ctx_4bfb151cec67` / coding sessions) |
| Scope | PR [#540](https://github.com/hangndat/ticket-solution/pull/540) · Issue [#521](https://github.com/hangndat/ticket-solution/issues/521) · Story [#493](https://github.com/hangndat/ticket-solution/issues/493) · Epic [#491](https://github.com/hangndat/ticket-solution/issues/491) · paths `apps/portal` (+ artifact `docs/reviews`) |
| Commit SHA | `02fe178409405a4d6041f0d7b988d5a215449593` (confirmed `git rev-parse` + `gh pr view` `headRefOid`) |
| Architecture | **Có** — ADR [`PORTAL-P2-ADR.md`](../architecture/PORTAL-P2-ADR.md) §8 `P2-ONBOARD-PENDING` · UX [`PORTAL-P2-UX.md`](../design/PORTAL-P2-UX.md) PS5 / **AC-PS5** · Decision IDs: **P2-ONBOARD-PENDING** · **P2-ROLES-PRESET** (invite preset sau merge #534) · **O17** (Epic P2) |
| Checks | Xem bảng dưới |
| Verdict DoD | **PASS with known gap** |

## Delta vs prior review (`4449bcaf`)

| Item | Prior (`4449bcaf`) | Revalidation (`02fe178`) |
| --- | --- | --- |
| GitHub Actions trên tip | Không có check-runs | **SUCCESS** trên exact SHA: `changes`, `portal`, `ci`, `turbo-persist` (irrelevant slices SKIPPED) |
| Mergeability | — | `mergeable=MERGEABLE` · `mergeStateStatus=CLEAN` |
| Rebase / merge main | n/a | `cc959aa` resolve conflicts sau #534 role presets; `02fe178` drop duplicate `bffRolePresets` / paths keys (typecheck fix) — onboarding PENDING/first-run logic **không** regress |
| Headless UAT Playwright | GAP | **Vẫn GAP** (Epic gate (a); không trong Verify Spec đợt này) |

## Checks (exact SHA `02fe178409405a4d6041f0d7b988d5a215449593`)

| Check | Kết quả |
| --- | --- |
| `git rev-parse HEAD` | `02fe178409405a4d6041f0d7b988d5a215449593` |
| `gh pr view 540` | `mergeable=MERGEABLE` · `mergeStateStatus=CLEAN` · `headRefOid=02fe1784…` |
| GitHub Actions check-runs trên tip SHA | **SUCCESS**: `changes`, `portal`, `ci`, `turbo-persist` · SKIPPED: backend/web/mobile/database-isolation/d5-* (đúng path filter portal) |
| Local: build `@ticket/contracts` + `@ticket/web-session` rồi `pnpm --filter @ticket/portal test` | **PASS** 123/123 |
| Local: `pnpm --filter @ticket/portal typecheck` | **PASS** |
| Onboarding unit focus (trong suite) | PENDING parse reject ACTIVE; first-run chỉ sau ACTIVE; Steps org→team→event→ready; `pickPrimaryTenant` prefers PENDING — **PASS** |
| Headless UAT (`scripts/web-uat.sh` / Playwright) | **Không chạy** trên SHA này |
| Mock auth / fake ACTIVE trên path production | **Không** — signup chỉ accept `status === 'PENDING'`; first-run gated `tenantStatus === 'ACTIVE'`; progress localStorage không claim server ACTIVE |

## Acceptance mapping (AC-PS5 / #521)

| AC | Verdict | Evidence |
| --- | --- | --- |
| Signup → tenant `PENDING`; UI `pending-activation`; không mutation admin như ACTIVE | **PASS** | BFF `POST /api/bff/public/tenant-registrations` → Nest `/v1/public/tenant-registrations` + CSRF + Idempotency-Key UUID; `parseRegistrationResponse` reject non-PENDING; `/onboarding/[tenantId]` Result `pending-activation` + Alert no-admin |
| Sau Operator ACTIVE → first-run Steps (org → Manager preset → event DRAFT → readiness); không paste UUID | **PASS** | Steps 0..3; invite qua BFF + `bffRolePresets` (sau merge #534, duplicate helper đã gỡ ở `02fe178`); event CTA `/t/…/events/new`; Idempotency-Key = `crypto.randomUUID()` |
| PENDING policy thắng BA ACTIVE-ngay (AC-E1 / ADR §8) | **PASS** | `shouldShowFirstRun` false khi PENDING; unit «PENDING policy wins»; không auto-ACTIVE client |
| BFF → `POST` tenant-registrations | **PASS** | `PORTAL_UPSTREAM.tenantRegistrations`; `forwardStaffBearer` |
| ADR `P2-ONBOARD-PENDING` | **PASS** | Khớp §8 phương án A: PENDING self-serve; ACTIVE chỉ Operator; first-run checklist sau ACTIVE |
| Mergeable CLEAN + CI xanh (Verify Spec revalidation) | **PASS** | `MERGEABLE`/`CLEAN` + check-runs SUCCESS trên `02fe178…` |
| Map UAT Playwright headless | **GAP** | Chưa có evidence `web-uat` trên exact SHA — Epic #491 gate (a); không chặn Task AC Verify Spec |

## Architecture đối chiếu (`P2-ONBOARD-PENDING`)

| Quyết định | Impl trên SHA |
| --- | --- |
| Self-serve tạo tenant **PENDING**; không auto-ACTIVE | Client parse bắt buộc `status: 'PENDING'`; UI không route như ACTIVE sau signup |
| ACTIVE chỉ Operator | First-run / admin mutations chỉ khi discovery `tenant.status === 'ACTIVE'`; PENDING surfaces Result chờ + refresh |
| First-run checklist sau ACTIVE | Steps org branding → invite Manager/preset → create event → readiness |
| Trust: public/authenticated registration + Idempotency-Key | BFF CSRF + UUID idempotency; Bearer forward — không staff secret browser |
| Invite preset (`P2-ROLES-PRESET`) | First-run loads `bffRolePresets`; merge #534 đã có preset path — `02fe178` chỉ dedupe helpers |

Không cần Architect gate riêng để merge: không thấy design drift đáng kể so với ADR §8 / PS5. BE registration (#520) ngoài scope PR.

## Findings

### Should-fix (không chặn AC-PS5 / Verify Spec)

1. **`saveOrg` khi branding GET fail** — vẫn có thể `patchOnboardingProgress(orgDone: true)` không PUT server (carry từ review `4449bcaf`).
2. **Step readiness** có thể hiển thị summary soft mà không fetch readiness API — copy soft; nên Empty/unknown hoặc fetch thật trước claim «all ready».

### Nit

- `onboardingPathForTenant`: hai nhánh PENDING / non-PENDING trả cùng path — dead branch.

### Blocker

Không.

## Limitations

- Reviewer **không merge** / không deploy / không đổi Project Status.
- Không headless UAT Playwright trên portal cho flow signup→PENDING→ACTIVE→first-run (gap có chủ đích cho Epic gate (a)).
- Artifact docs có thể commit **sau** SHA đang duyệt (docs-only); verdict gắn **code SHA** `02fe178409405a4d6041f0d7b988d5a215449593`.
- CRG graph build SHA có thể lệch worktree khác; review dựa source + unit tests + GitHub check-runs trên exact tip.

## Draft comment PR (VI)

```text
## DoD revalidation (reviewer-dod) — PASS with known gap

- SHA: `02fe178409405a4d6041f0d7b988d5a215449593` (sau rebase; **không** kế thừa PASS `4449bcaf`)
- Reviewer: James · `reviewer-dod` · terminal `term_679b613f-eeef-4487-860e-1e69089ccc7c` · ≠ implementer
- Artifact: `docs/reviews/PORTAL-PR-540-dod.md`
- Mergeable: MERGEABLE / CLEAN · CI trên tip: changes + portal + ci + turbo-persist = SUCCESS
- Local: `pnpm --filter @ticket/portal test` 123/123 · typecheck — pass
- AC-PS5 / ADR P2-ONBOARD-PENDING: signup→PENDING wait (không fake ACTIVE), first-run sau ACTIVE, BFF POST registrations — đạt; rebase #534 chỉ dedupe rolePresets helpers
- Known gap: chưa headless UAT Playwright trên SHA (Epic gate (a))
- Không merge từ reviewer
```
