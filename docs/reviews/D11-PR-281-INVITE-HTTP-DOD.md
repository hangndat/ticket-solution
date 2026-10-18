# D11 — DoD review PR #281 / Issue #271 (invite HTTP CSRF + VI)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Role `reviewer-dod` · Orca Dispatch `ctx_ca9c5ef6afb5` · terminal `term_ca67c66a-43da-46be-aff5-ece9ff8a76aa` · **≠** implementer `ctx_23223774b34c` |
| Scope | Issue #271 · PR #281 · ownership `apps/web` only · Architecture impact: Không |
| Commit SHA | `375ad7ab1eef89b7f720e834dc5b58a76ad1bf3d` (PR tip; `git rev-parse` khớp worktree) |
| Verdict | **FAIL** |

## Checks (trên SHA)

| Check | Kết quả |
| --- | --- |
| Diff scope vs `main` | Chỉ `apps/web` (+ evidence docs) — đúng ownership |
| Unit: `pnpm --filter @ticket/web exec tsx --test tests/invite-messages.test.ts tests/invite-csrf.test.ts` | **12 pass** (chạy trên cùng SHA qua worktree sibling có `node_modules`) |
| CI `web` job · run [39094490312](https://github.com/hangndat/ticket-solution/actions/runs/39094490312) | **FAILURE** — `@ticket/web:lint` |
| Lint root cause | `apps/web/app/invite/invite-accept.tsx:112` — `setTokenOverride` synchronous trong `useEffect` (React compiler eslint cascading-renders) |
| Headless UAT re-run (reviewer) | Không tái chạy stack Keycloak/Nest trong session review; đối chiếu evidence + artifacts implementer (gitignored) |
| Implementer evidence | `docs/reviews/D11-INVITE-271-EVIDENCE.md` — claim accept ACTIVE + CSRF Origin negative; screenshots sibling wt `apps/web/.uat-artifacts/invite-http-*.png` |

## Checklist DoD

| # | Tiêu chí | Kết quả |
| --- | --- | --- |
| 1 | CSRF bootstrap `/invite` via GET `/api/bff/me/tenants` + park `?token`/`#token` | **PASS (code)** — `InviteAcceptForm` gọi `platformGet('/api/bff/me/tenants')`; `parkQueryTokenIfPresent` + `persistInviteToken` + `history.replaceState` strip URL |
| 2 | Copy VI fail-closed (không raw code); Origin negative | **PASS (code + unit)** — `invite-messages.ts` map INVITE_*/CSRF_* sang VI; unit + UAT script + `routes.integration.mjs` assert `CSRF_ORIGIN_REQUIRED` / `CSRF_ORIGIN_MISMATCH` |
| 3 | Owner accept → ACTIVE với Keycloak thật; gap `OIDC_ISSUER` LAN | **PASS with known gap (evidence)** — implementer ghi accept thật + gap JWT `iss` LAN (`192.168.86.8:8080`) cho API isolated; reviewer không re-prove live trong session này |
| 4 | Tests/UAT commands + artifact paths | **PASS (partial)** — commands trong evidence; UAT artifacts local gitignored; unit 12 pass trên SHA |
| 5 | CI web trên SHA | **FAIL** — lint đỏ trên tip; aggregate `ci` FAILURE |

## Findings

### Blocker

1. **CI web không xanh trên exact SHA** — eslint error tại `invite-accept.tsx` L109–117 (`setTokenOverride(parked)` trong effect). Issue AC #5 và DoD integration yêu cầu CI xanh trước merge. **Phải fix lint rồi revalidate SHA mới.**

### Should-fix / nits (không đủ để FAIL riêng nếu CI xanh)

2. Evidence tip SHA trong `D11-INVITE-271-EVIDENCE.md` vẫn ghi `8fe71f83…` trong khi PR tip đang review là `375ad7ab…` (commit “align tip” không tự pin HEAD). Cập nhật khi revalidate.
3. Copy CSRF detail còn từ “Origin” / “fail-closed” (test cho phép) — không lộ raw `CODE:` làm title; chấp nhận được.
4. `messageForInviteError` unmapped code có thể đưa `fallbackMessage` English vào detail — nên giữ generic VI-only nếu muốn cứng hơn.

## Limitations

- Reviewer không merge, không sửa production code (chỉ artifact này).
- Không tái chạy headless UAT + Keycloak trong session DoD; AC accept dựa trên evidence implementer + unit/CI.
- Graph MCP incremental trên worktree này báo `head_matches` lệch SHA khác branch; review dựa source + `gh` CI + unit trên cùng tip SHA.

## Verdict rationale

Product paths CSRF/VI/token-park và unit tests đạt; evidence Keycloak accept có known gap env `OIDC_ISSUER` LAN (hợp lệ nếu CI xanh). **DoD FAIL** vì gate CI web trên SHA `375ad7ab1eef89b7f720e834dc5b58a76ad1bf3d` đỏ — không `PASS` / không `PASS with known gap` cho lint CI.
