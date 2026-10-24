# DoD review — D9 E2E Web redeem → iOS tickets (#200 / PR #202)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor worker · Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · terminal `term_dbcec075-7f95-4889-a169-7a50a361b5a5` · dispatch `ctx_2299f86cb6aa` · worktree `d9-e2e-dod-reviewer` · task `task_b14a515d7e02` |
| Implementer (≠ reviewer) | dispatch `ctx_968fd7fa0740` |
| Scope | Issue [#200](https://github.com/hangndat/ticket-solution/issues/200) · PR [#202](https://github.com/hangndat/ticket-solution/pull/202) · Epic [#134](https://github.com/hangndat/ticket-solution/issues/134) · đóng known gap [#147](https://github.com/hangndat/ticket-solution/issues/147) bake URL · paths `docs/reviews/D9-E2E-WEB-IOS-TICKET.md`, `docs/reviews/d9-uat/e2e-web-ios/**`, `scripts/web-uat.mjs` |
| Commit SHA | `80a36138d179a4705b06a7c17baae174e959f701` (exact tip PR #202; evidence PNGs + `redeem` @ `d691d7eeed859d496ad1a17868b1464bf87d6fc1`) |
| Agent | `cursor` (orca-agent-routing) |

## Checks (trên exact SHA)

| Check | Result |
| --- | --- |
| Tip PR #202 = SHA review | `80a36138d179a4705b06a7c17baae174e959f701` = `origin/hangndat/d9-e2e-web-ios-ticket-2` |
| Diff ownership | `docs/reviews/D9-E2E-WEB-IOS-TICKET.md` + 4 PNG + `scripts/web-uat.mjs` — **không** `apps/api|web|mobile` · không Nest public route |
| Secrets | Chỉ fixture local (`attendee-demo`, pepper demo, LAN IP) — không secret prod |
| iOS bake local (AC1) | Artifact ghi `EXPO_PUBLIC_API_BASE_URL=http://192.168.86.8:3001` + Info.plist `apiBaseUrl` cùng host — **không** `api.vemoki.com`; rebuild local Release-for-sim · Team `BLUA62D52G` · **không** EAS Cloud |
| Web headless redeem (AC2) | `scripts/web-uat.mjs` thêm `redeem` (chrome-headless-shell); claim `DEMO-FUN-006` → BFF tickets **200** `ticketCount=1`; user `attendee@example.com` |
| iOS My Tickets cùng user (AC3) | Curated `d9-uat/e2e-web-ios/ios/d9-e2e-my-tickets.png`: **ACTIVE · v1** · Tenant `d9d9f001-0001-4000-8000-000000000001` · sync `2026-10-17T15:21:59Z` — khớp seed demo-fun |
| Published-list không lỗi do prod (AC4) | UI ErrorState fail-closed (không fallback fixture-as-published); curl local `GET …/v1/public/tenants/demo-fun/events` → Nest **404** (prod cùng path cũng 404) — bake gap #147 **đóng**; HTTP 200 public list **ngoài scope** |
| Headless / no EAS (AC6) | web-uat headless; sim-uat AXe/simctl documented; không EAS Cloud; không computer-use |
| CI tip PR #202 | `changes` SUCCESS · `ci` SUCCESS · web/mobile/backend/db **SKIPPED** (docs+script) — [run 39044858391](https://github.com/hangndat/ticket-solution/actions/runs/39044858391) |
| Pilot / deploy | Artifact: không deploy prod; **không** claim pilot ready |

## Findings

| Severity | Finding |
| --- | --- |
| Known gap (chấp nhận theo Task #200 / coordinator) | Nest thiếu `GET /v1/public/tenants/...` → **404** trên local **và** prod. Published-list UI lỗi là fail-closed đúng; **không** còn do bake `api.vemoki.com`. Không claim pilot. |
| Should-fix (UAT harness, không blocker AC chính) | `cmdRedeem` successHint `/đã cấp\|ticketId\|ACTIVE\|Vé/i` **khớp** nút luôn hiện *「Xem vé của tôi」* → có thể pass race trước khi redeem xong. |
| Nit (evidence quality) | Curated `d9-uat/e2e-web-ios/web/d9-e2e-redeem.png` vẫn hiện *「Đang xác minh mã…」* / *「Đang xử lý…」* — không phải success surface; độ tin cậy dựa bảng tickets 200 + iOS ACTIVE, không dựa PNG web success. |
| Nit | Tip SHA trong artifact ghi `git rev-parse HEAD` thay vì literal `80a36138…` (PR body đã pin đúng tip). |

Không blocker ownership / secrets / EAS / headless / bake-prod / thiếu iOS ACTIVE.

## Verdict

**PASS with known gap**

- Gap: Nest public published-list route 404 (local=prod) — limitation backend riêng; **không** vi phạm AC đóng bake `api.vemoki.com` trong #200.
- AC Web→iOS cùng attendee: **đạt** qua iOS ACTIVE + tenant seed khớp + claim BFF tickets 200 (web PNG curated yếu — nit, không đảo verdict).
- Reviewer ≠ implementer; exact SHA tip; **không merge** (coordinator).

## Revalidation

Commit hành vi mới sau `80a36138d179a4705b06a7c17baae174e959f701` → bắt buộc DoD lại; không kế thừa verdict.
