# D13 — DoD review PR #405 (web deeplink slug→tenantId / `#400`)

| Trường | Giá trị |
| ------ | ------- |
| Reviewer / session | Role `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` · agent Cursor · Orca dispatch `ctx_54868d0330e8` · terminal `term_77e7a900-e49a-4a97-963f-915728b31680` · task `task_84d0ea39fbf2` · **≠** implementer |
| Scope | Issue [#398](https://github.com/hangndat/ticket-solution/issues/398) · PR [#405](https://github.com/hangndat/ticket-solution/pull/405) (supersedes [#399](https://github.com/hangndat/ticket-solution/pull/399)+[#402](https://github.com/hangndat/ticket-solution/pull/402)) · ownership **web** · paths `apps/web/app/t/[tenantSlug]/tickets/**`, `apps/web/src/owner-ticket/**`, `apps/web/app/api/bff/tickets/**`, proxy/auth/post-login, tests |
| Commit SHA (exact) | `11510520595c05b921f48eda3814007daa71bfd4` |
| Architecture impact | **Không** — consume OpenAPI `#400`; không đổi shared contract |
| Chain checklist | [`D13-BUG-DEEPLINK-CHAIN-DOD.md`](./D13-BUG-DEEPLINK-CHAIN-DOD.md) |
| Ngày review | 2026-10-18 |
| Verdict | **PASS with known gap** |

Không merge trong review này. Artifact DoD **không** commit lên tip PR (giữ exact SHA ổn định).

---

## Revalidation vs prior FAIL

Prior FAIL: #399/#402 gửi/`wire` **`tenantSlug`** thay vì resolve **`tenantId` UUID** rồi gọi Nest `#400`.

Trên tip `11510520595c05b921f48eda3814007daa71bfd4`:

1. `loadOwnerTicket` → `GET /v1/me/tenants` (hoặc `?tenantId=` UUID) → `resolveOwnerTenantId` → `GET /v1/me/tickets/{id}?tenantId=<UUID>`.
2. BFF `apps/web/app/api/bff/tickets/[ticketId]/route.ts` **require** `tenantId` UUID (422 `TENANT_REQUIRED`); comment cấm `tenantSlug` query.
3. Unit `loadOwnerTicket` assert URL có `tenantId=` UUID và **`!url.includes('tenantSlug=')`**.
4. OpenAPI trên `main` (sau merge #400 `821ae07`): `/v1/me/tickets/{ticketId}` + required query `tenantId` — khớp consumer.

→ Gate contract FAIL **đã clear** (C1–C3).

---

## Checks (trên SHA `11510520595c05b921f48eda3814007daa71bfd4`)

| Check | Kết quả |
| ----- | ------- |
| `git rev-parse` / `gh pr view 405` tip | Match `11510520595c05b921f48eda3814007daa71bfd4` |
| Diff ownership | Chỉ `apps/web/**` (+ README web) — không BE/iOS |
| `pnpm --filter @ticket/web exec tsx --test tests/owner-ticket.test.ts` | **12 pass / 0 fail** trên tip |
| CI `gh pr checks 405` | `web` pass · `changes` pass · `ci` pass · `turbo-persist` pass · backend/mobile/db skip (đúng path filter) |
| Secrets | Không `.env` / credential thật |
| Anonymous deeplink | `proxy.ts` 307 → `/auth?next=` cho owner-ticket path; `routes.integration.mjs` asserts 307 + không render missing/ready |
| Post-login allowlist | `sanitizePostLoginPath` + `isOwnerTicketPath` |
| CRG | `list_graph_stats_tool` OK; `detect_changes_tool` risk nhiễu (graph build SHA ≠ tip) — fallback source + tests + CI |
| Authenticated headless UAT | **Không chạy** trên tip (gap) |

---

## Findings

### Blocker

Không có — contract `tenantSlug` FAIL không còn trên tip.

### Known gaps (chấp nhận cho PR #405; **không** nuốt C1–C5)

1. **C6 — authenticated owner runtime UAT** chưa có headless evidence trên tip (unit mock chứng minh wiring; Nest `#400` đã merge `main`). Follow-up UAT optional trước khi tuyên bố pilot; **không** reopen contract FAIL.
2. Attendee không có membership slug trong `me/tenants` → `tenant-unresolved` (không bịa public slug map) — intentional fail-closed; document trên PR.

### Nits

- Không.

---

## Verdict

**PASS with known gap**

- Prior chain FAIL (slug/`tenantSlug` vs `#400` `tenantId` UUID) **PASS** trên exact SHA.
- Gap C6 (authenticated live UAT) không tái tạo contract mismatch và không chặn merge nếu coordinator đã ủy quyền integration + CI xanh.
- Revalidation bắt buộc nếu tip đổi hành vi resolve/BFF sau `11510520595c05b921f48eda3814007daa71bfd4`.
- Coordinator: không tự `Hoàn thành` #398 chỉ vì artifact này nếu AC còn yêu cầu authenticated UAT evidence — ghi rõ gap hoặc spawn UAT follow-up.
