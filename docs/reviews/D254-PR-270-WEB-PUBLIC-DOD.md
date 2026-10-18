# DoD review — PR #270 / Issue #256 (web public events, ADR-19)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Orca worker Cursor · Role `reviewer-dod` · Task `task_012c5d21d13f` · Dispatch `ctx_f43a47bd2f34` · terminal `term_d64f0d7e-c248-40f8-914c-2471f38a44e4` |
| Implementer (≠ reviewer) | Dispatch `ctx_96f005a81fd2` · Role `web` · evidence `docs/reviews/D254-WEB-PUBLIC-EVENTS-256.md` |
| Scope | Epic [#254](https://github.com/hangndat/ticket-solution/issues/254) · Issue [#256](https://github.com/hangndat/ticket-solution/issues/256) · PR [#270](https://github.com/hangndat/ticket-solution/pull/270) · ownership **web** (`apps/web` + docs review) |
| Commit SHA | `74455701bf3a6013f0d47acec7602d442c9cbc6a` (xác nhận REST `GET /repos/hangndat/ticket-solution/pulls/270` → `head.sha`; local `git rev-parse HEAD` khớp) |
| Architecture impact | **Có** — consumer [ADR-19](../ops/ADR-19-EVENT-SERVER-SOURCE.md) + [event-server-source.md](../architecture/event-server-source.md); BE dep PR #261 đã DoD PASS |
| Verdict | **PASS** |

## Checklist DoD / AC

| # | Tiêu chí | Kết quả |
| --- | --- | --- |
| 1 | Home `/` đọc published list từ Nest (SSR/ISR), không fixture SoT | **PASS** — `app/page.tsx` `revalidate=60`; `loadPublishedEventList` qua `homeTenantSlugs` (default `demo-fun,demo-studio`); empty/unreachable/invalid → `SurfaceState` VI |
| 2 | `/t/.../events/...` đọc published detail; bỏ `generateStaticParams` / fixture SSG | **PASS** — `loadPublishedEventDetail`; `not-found` → `notFound()`; unreachable/invalid → SurfaceState; không import `findDemoEvent` |
| 3 | Không fallback fixture khi API lỗi | **PASS** — loaders map 5xx/network → `unreachable`, schema lệch → `invalid`; unit assert không invent fixture trên 404/ECONNREFUSED; `routes.integration.mjs` cấm Sunburst/Northline HTML khi Nest down |
| 4 | BFF list proxy nếu thiếu | **PASS** — `GET /api/bff/public/tenants/{tenantSlug}/events` → `forwardPublic`; Nest down → 502 `UPSTREAM_UNAVAILABLE` (assert trong routes) |
| 5 | Fixture SoT archive; `events.ts` không còn catalog path | **PASS** — `findDemoEvent` removed; data ở `src/fixtures/archived-demo-events.ts`; public pages import `src/published/*` only |
| 6 | Prefer published media URLs; demo pack chỉ seed tường minh | **PASS** — `EventBanner`/`EventLogo`: `sanitizeMediaUrl(url) ?? demoPack`; pack theo id/slug seed allowlist; Home gắn `· Demo` khi `isExplicitDemoLabel` |
| 7 | Ownership web-only; không secrets | **PASS** — diff 20 files trong `apps/web` + implementer evidence; `.env.example` chỉ doc `PUBLIC_HOME_TENANT_SLUGS` |
| 8 | ADR-19 architecture đối chiếu | **PASS** — PG published SoT via Nest; client fixtures không SoT/fallback; SSR/ISR; fail-closed; marketing từ sections; catalog quanh D9 slugs |
| 9 | CI + checks trên exact tip SHA | **PASS** — xem Checks |

## Findings

| Mức | Finding |
| --- | --- |
| — | Không blocker / should-fix trước merge theo AC #256. |
| Nit | `docs/design/event-server-source/ui-states.md` không có trong worktree này; copy VI tự ghi “aligned with PD” — khớp architecture failure matrix, nhưng file PD gốc chưa verify tại path đó. |
| Nit | `DEMO_MEDIA_TENANT_SLUGS` vẫn gồm `sunburst`/`northline` cho media pack khi thiếu URL — chỉ chrome ảnh, không phục vụ catalog SoT; Home mặc định không list các tenant đó. |

## Limitations / ngoài phạm vi

- Headless happy-path UAT (`scripts/web-uat.sh`) với Nest + D9 seed **chưa** chạy trong session implementer/reviewer (Nest local không sẵn). Fail-closed path đã cover bởi `pnpm test:routes` + CI `web`. Happy-path UAT thuộc gate milestone/Epic #254, không chặn AC Task #256.
- Không merge `main` trong review này (Task: review only).
- PR #268 (superseded) ngoài phạm vi chốt merge của reviewer.

## Checks (trên SHA `74455701bf3a6013f0d47acec7602d442c9cbc6a`)

```text
# Tip
gh api repos/hangndat/ticket-solution/pulls/270 --jq .head.sha
→ 74455701bf3a6013f0d47acec7602d442c9cbc6a
git rev-parse HEAD
→ 74455701bf3a6013f0d47acec7602d442c9cbc6a

# CI tip (actions/runs/39091498649, head_sha khớp)
web SUCCESS · ci SUCCESS · changes SUCCESS · turbo-persist SUCCESS
(backend/mobile/database-isolation/d5-* skipped — web-only path filter)

# Local (reviewer worktree, sau pnpm install + contracts build)
cd apps/web && pnpm exec tsx --test \
  tests/published-events.test.ts \
  tests/published-api.test.ts \
  tests/events.test.ts \
  tests/demo-media.test.ts
→ 17 pass

# Source review
apps/web/app/page.tsx
apps/web/app/t/[tenantSlug]/events/[eventSlug]/page.tsx
apps/web/app/api/bff/public/tenants/[tenantSlug]/events/route.ts
apps/web/src/published/{api,parse,copy,home-tenants,index,format}.ts
apps/web/src/events.ts
apps/web/src/fixtures/archived-demo-events.ts
apps/web/tests/routes.integration.mjs
docs/ops/ADR-19-EVENT-SERVER-SOURCE.md
```

## Verdict

**PASS** trên exact SHA `74455701bf3a6013f0d47acec7602d442c9cbc6a`.

Coordinator có thể merge sau khi đủ quyền integration + CI xanh trên tip; Project `Hoàn thành` chỉ sau merge + CI trên integrated commit theo DoD. Milestone/Epic #254 vẫn cần headless UAT happy-path khi Nest+seed sẵn sàng.
