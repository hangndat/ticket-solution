# DoD — PR #540 portal self-serve onboarding PENDING + first-run (#521)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Orca Cursor `reviewer-dod` · terminal `term_e806fffa-d905-4cdb-944e-4139562d74ce` · task `task_a0393a8243e3` · dispatch `ctx_b95290c5e273` · Run `run_d04055a8969b` · **≠** implementer `ctx_4bfb151cec67` |
| Scope | PR [#540](https://github.com/hangndat/ticket-solution/pull/540) · Issue [#521](https://github.com/hangndat/ticket-solution/issues/521) · Story [#493](https://github.com/hangndat/ticket-solution/issues/493) · Epic [#491](https://github.com/hangndat/ticket-solution/issues/491) · paths `apps/portal` (+ artifact `docs/reviews`) |
| Commit SHA | `4449bcafe90e69a776407c8e89f6a3de1ee2297f` (confirmed `git rev-parse HEAD`) |
| Architecture | **Có** — ADR [`PORTAL-P2-ADR.md`](../architecture/PORTAL-P2-ADR.md) §8 `P2-ONBOARD-PENDING` · UX [`PORTAL-P2-UX.md`](../design/PORTAL-P2-UX.md) PS5 / **AC-PS5** · Decision IDs: **P2-ONBOARD-PENDING** · **P2-ROLES-PRESET** (invite preset) · **O17** (Epic P2) |
| Checks | Xem bảng dưới |
| Verdict DoD | **PASS with known gap** |

## Checks (exact SHA)

| Check | Kết quả |
| --- | --- |
| `git rev-parse HEAD` | `4449bcafe90e69a776407c8e89f6a3de1ee2297f` |
| GitHub Actions CI trên tip SHA | **Chưa có check-runs** (`gh api …/check-runs` → `total_count: 0`); `gh pr checks 540` → no checks. Cloudflare suite queued — **không** chứng minh CI xanh. |
| Local: build `@ticket/contracts` + `@ticket/web-session` rồi `pnpm --filter @ticket/portal test` | **PASS** 114/114 |
| Local: `pnpm --filter @ticket/portal typecheck` | **PASS** (sau build workspace packages) |
| Local: `pnpm --filter @ticket/portal lint` | **PASS** (`eslint . --max-warnings 0`) |
| Onboarding unit focus | `tests/onboarding.test.ts` + `tests/ops-paths.test.ts` — **PASS** 8/8 (PENDING parse reject ACTIVE; first-run chỉ sau ACTIVE; Steps org→team→event→ready; `tenantRegistrations` upstream path) |
| Headless UAT (`scripts/web-uat.sh` / Playwright) | **Không chạy** trên SHA này (thiếu stack/auth fixture trong session review) |
| Mock auth / fake ACTIVE trên path production | **Không** — signup chỉ accept `status === 'PENDING'`; first-run gated `tenantStatus === 'ACTIVE'`; progress localStorage không claim server ACTIVE |

## Acceptance mapping (AC-PS5 / #521)

| AC | Verdict | Evidence |
| --- | --- | --- |
| Signup → tenant `PENDING`; UI `pending-activation`; không mutation admin như ACTIVE | **PASS** | BFF `POST /api/bff/public/tenant-registrations` → Nest `/v1/public/tenant-registrations` + CSRF + Idempotency-Key UUID; `parseRegistrationResponse` reject non-PENDING; `/onboarding/[tenantId]` Result `pending-activation` + Alert no-admin; home/`/t/[tenantId]`/shell redirect hoặc surface PENDING |
| Sau Operator ACTIVE → first-run Steps (org → Manager preset → event DRAFT → readiness); không paste UUID | **PASS** | Steps 0..3; invite `role: Manager \| { presetId }` qua BFF invites (reject client permission arrays); event CTA `/t/…/events/new`; readiness + setup deep-link; Idempotency-Key = `crypto.randomUUID()` |
| PENDING policy thắng BA ACTIVE-ngay (AC-E1 / ADR §8) | **PASS** | `shouldShowFirstRun` false khi PENDING; unit «PENDING policy wins»; signup copy `onboarding.signup.pendingPolicy`; không auto-ACTIVE client |
| BFF → `POST` tenant-registrations | **PASS** | `PORTAL_UPSTREAM.tenantRegistrations = '/v1/public/tenant-registrations'`; `forwardStaffBearer` |
| ADR `P2-ONBOARD-PENDING` | **PASS** | Khớp §8 phương án A: PENDING self-serve; ACTIVE chỉ Operator; first-run checklist sau ACTIVE |
| Map UAT Playwright headless | **GAP** | Chưa có evidence `web-uat` trên exact SHA — xem Limitations |

## Architecture đối chiếu (`P2-ONBOARD-PENDING`)

| Quyết định | Impl trên SHA |
| --- | --- |
| Self-serve tạo tenant **PENDING**; không auto-ACTIVE | Client parse bắt buộc `status: 'PENDING'`; UI không route như ACTIVE sau signup |
| ACTIVE chỉ Operator | First-run / admin mutations chỉ khi discovery `tenant.status === 'ACTIVE'`; PENDING surfaces Result chờ + refresh |
| First-run checklist sau ACTIVE | Steps org branding → invite Manager/preset → create event → readiness |
| Trust: public/authenticated registration + Idempotency-Key | BFF CSRF + UUID idempotency; Bearer forward — không staff secret browser |
| Invite preset (`P2-ROLES-PRESET`) | `parseInviteRole` accept role enum hoặc `{ presetId }` UUID; reject permission arrays |

Không cần Architect gate riêng để merge: không thấy design drift đáng kể so với ADR §8 / PS5 cho wave UI này. BE registration (#520) ngoài scope PR.

## Findings

### Should-fix (không chặn AC-PS5 coding)

1. **`saveOrg` khi branding GET fail** — vẫn `patchOnboardingProgress(orgDone: true)` không PUT server. Nên fail-closed hoặc retry rõ, tránh coi step org xong khi chưa persist branding.
2. **Step readiness** hiển thị `readiness.summary.allReady` mà không gọi readiness API — copy soft; nên Empty/unknown hoặc fetch thật trước claim «all ready».
3. **GitHub Actions CI chưa gắn tip SHA** — merge/Hoàn thành cần CI xanh trên exact tip (sau docs commit nếu có).

### Nit

- `onboardingPathForTenant`: hai nhánh PENDING / non-PENDING trả cùng path — dead branch.
- Signup Card gradient hơi warm/cream — gần anti-pattern visual budget PD §0; không chặn AC.

### Blocker

Không (cho AC coding #521 trên exact SHA review).

## Limitations

- Reviewer **không merge** / không deploy / không đổi Project Status.
- Không headless UAT Playwright trên portal cho flow signup→PENDING→ACTIVE→first-run.
- CI Actions chưa observed SUCCESS trên `4449bcafe90e69a776407c8e89f6a3de1ee2297f`.
- CRG `detect_changes` trên worktree này gắn graph build SHA khác (`141dba74…`) — review dựa source + unit tests, không risk score graph.
- Artifact docs có thể commit **sau** SHA đang duyệt (docs-only); verdict gắn **code SHA** `4449bcafe90e69a776407c8e89f6a3de1ee2297f`.

## Draft comment PR (VI)

```text
## DoD review (reviewer-dod) — PASS with known gap

- SHA: `4449bcafe90e69a776407c8e89f6a3de1ee2297f` (≠ implementer `ctx_4bfb151cec67`)
- Artifact: `docs/reviews/PORTAL-PR-540-dod.md`
- Local: `pnpm --filter @ticket/portal test` 114/114 · typecheck · lint — pass (sau build contracts/web-session)
- AC-PS5 / ADR P2-ONBOARD-PENDING: signup→PENDING wait (không fake ACTIVE), first-run sau ACTIVE, BFF POST `/v1/public/tenant-registrations` — đạt
- Known gap: chưa headless UAT Playwright trên SHA; GitHub Actions chưa có check-runs trên tip — chờ CI xanh trước merge
- Không merge từ reviewer
```
