# DoD — PR #460 portal P0.2 PREP (T-WEB-PREP / #420)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Orca Cursor `reviewer-dod` · terminal `term_0ca5a3fd-6b8f-4d8d-b7c6-5910512644cd` · task `task_3503bb19630e` · dispatch `ctx_3058bb40270b` · Run `run_34fde1e32ed1` · **≠** implementer `ctx_5362712e1a39` |
| Scope | PR [#460](https://github.com/hangndat/ticket-solution/pull/460) · Issue [#420](https://github.com/hangndat/ticket-solution/issues/420) · Story S2 / Epic [#406](https://github.com/hangndat/ticket-solution/issues/406) · paths `apps/portal` (+ artifact `docs/reviews`) |
| Commit SHA | `5d878ea5655ecc8ecbc6f62824f32c5c76c44af4` (confirmed `git rev-parse HEAD`) |
| Architecture | **Có** — ADR-20 portal admin / AntD / same-origin BFF · Decision IDs: **ADR-20** · **O02** (nav theo permission server) · `GATE-STAY-APP` |
| Checks | Xem bảng dưới |
| Verdict DoD | **PASS with known gap** |

## Checks (exact SHA)

| Check | Kết quả |
| --- | --- |
| `git rev-parse HEAD` | `5d878ea5655ecc8ecbc6f62824f32c5c76c44af4` |
| Local: build `@ticket/contracts` + `@ticket/web-session` rồi `pnpm --filter @ticket/portal test` | **PASS** 29/29 (capabilities deny-by-default, readiness publish≠Gate, OIDC/origin/refresh fail-closed, create-event body allowlist) |
| Local: `pnpm --filter @ticket/portal typecheck` | **PASS** (sau build workspace packages) |
| CI check-runs trên tip SHA (REST) | **portal / changes / ci / turbo-persist** = `success`; backend/web/mobile/database-isolation/d5-* = `skipped` (path filter — PR chỉ `apps/portal`) |
| Graph `detect_changes` vs `origin/main` | 41 files trong PR tip · risk ~0.85 · nhiều BFF handlers mới thiếu test riêng từng route |
| Mock UAT / mock auth trên path production | **Không** — chỉ comment “Never invent mock credentials”; fixture JWKS giới hạn trong tests |

## Acceptance mapping (T-WEB-PREP / P0.2)

| AC | Verdict | Evidence |
| --- | --- | --- |
| Events list + wizard tạo sự kiện | **PASS** | `events/page.tsx`, `events/new/page.tsx` (Steps 3 bước); BFF `GET/POST …/events` + Idempotency-Key UUID |
| Event CRUD metadata + clone + archive | **PASS** | `setup/page.tsx` PATCH name / POST clone / POST archive; BFF routes tương ứng + CSRF |
| Types / sources / quota | **PASS** | Pages + BFF `ticket-types`, `sources`, `quota` (quota read); menu gated bởi permission setup |
| Content / brand / preview / publish | **PASS** | `config/page.tsx` draft+publish+rollback; `settings/page.tsx` org branding; overview readiness + publish CTA |
| Staff directory / invites | **PASS** | `members/page.tsx` list + invite + revoke member/invite; BFF members/invites; event gán qua `Select` từ MeEvents |
| Không UUID tay luồng chính | **PASS** | Route params + discovery Select; `crypto.randomUUID()` chỉ cho Idempotency-Key; copy UI cấm dán UUID |
| Publish ≠ redeem ≠ Gate | **PASS** | `readiness.ts` + Alert/Modal trên overview/config/wizard; Gate chỉ deeplink `app.` + `report.read` nav |
| Shell overview O12 | **PASS** | Event overview report snapshot (quota/pending/check-in) khi `report.read` |
| Auth fail-closed / no mock UAT | **PASS** | `assertMutatingBrowser` (Origin+CSRF) trên mọi mutate BFF mới; `forwardStaffBearer` refresh fail → clear+401; UI `permission-denied` khi thiếu Me*; không mock session |

## Architecture đối chiếu (ADR-20)

| Quyết định ADR-20 | Impl trên SHA |
| --- | --- |
| `PORTAL-SEPARATE-APP` + AntD | Surfaces trong `apps/portal` AntD Form/Table/Steps/Modal |
| Same-origin BFF + Origin fail-closed | `assertSameOrigin` / `assertMutatingBrowser` trên mutate |
| Refresh fail-closed, không mock | `forwardStaffBearer` + tests refresh-flight / oidc |
| `GATE-STAY-APP` | Deeplink + notice; không host Gate scan trên portal |
| UI không cấp quyền (Nest+RLS) | Chrome/menu từ Me permissions; BFF chỉ forward Bearer — authz thật ở API |
| O02 chrome theo permission | `capabilities.ts` + tests: `gate.confirm` ≠ Gate report nav |

Không cần Architect gate riêng để merge: không thấy design drift đáng kể so với ADR-20 §2–§6 cho wave PREP.

## Findings

### Should-fix (không chặn AC T-WEB-PREP)

1. **Thiếu unit test riêng cho từng BFF route PREP mới** — CSRF/origin được cover bởi foundation tests + audit pattern (mọi mutate gọi `assertMutatingBrowser`); nên bổ sung smoke route-level khi harden.
2. **Headless UAT portal** chưa chạy trên SHA này — đúng roadmap (`T-UAT-PORTAL` P1); không phải AC của T-WEB-PREP.

### Nit

- Menu “Chuẩn bị/types/…” hiện khi có bất kỳ trong `{event.update, config.publish, inventory.import, event.config}` — rộng hơn một permission; Nest vẫn deny-by-default trên từng endpoint.

### Blocker

Không.

## Limitations

- Reviewer **không merge**, không deploy, không DNS.
- GraphQL `gh pr view` rate-limit lúc review; CI lấy qua REST check-runs trên exact SHA.
- Artifact docs có thể commit **sau** SHA đang duyệt (docs-only); verdict gắn **code SHA** `5d878ea5655ecc8ecbc6f62824f32c5c76c44af4`.

## Merge note

Coordinator có thể merge sau khi xác nhận CI vẫn xanh trên tip và không có commit hành vi mới sau SHA này (nếu có → revalidation bắt buộc).
