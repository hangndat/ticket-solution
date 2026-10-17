# DoD review — D8-S4-T1 UAT headless multi-tenant branding (#131 / PR #216)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca Cursor worker · Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · terminal `term_6328860c-9691-415f-8f50-804dfa5d328e` · dispatch `ctx_843f06f4b7e5` · task `task_48d92df41e88` · worktree `hangndat-dod-pr216` |
| Implementer (≠ reviewer) | dispatch `ctx_c2448785328c` |
| Scope | Issue [#131](https://github.com/hangndat/ticket-solution/issues/131) · PR [#216](https://github.com/hangndat/ticket-solution/pull/216) · Story [#130](https://github.com/hangndat/ticket-solution/issues/130) · Epic [#119](https://github.com/hangndat/ticket-solution/issues/119) · paths `docs/reviews/D8-S4-T1-UAT.md` + `docs/reviews/d8-uat/s4-t1/**` |
| Commit SHA (exact, under review) | `156ae764410235ada2c62f68f00b5718949e66e2` |
| Agent | `cursor` (orca-agent-routing) |
| Ngày review | 2026-10-18 |

## Checks (trên exact SHA)

| Check | Result |
| --- | --- |
| `git rev-parse` / PR tip | `156ae764410235ada2c62f68f00b5718949e66e2` = `gh pr view 216` `headRefOid` |
| Diff ownership | Chỉ 7 file dưới `docs/reviews/**` (+89 dòng markdown + 6 PNG) — **không** sửa `apps/api` / `apps/web` / `apps/mobile` product code |
| Secrets | Không `.env` / credential / signing material trong diff |
| AC Issue #131 — ≥2 tenant fixture + screenshot web + sim | **PASS** — web `sunburst` vs `northline`; iOS `demo-fun` vs `demo-studio` (+ slug toggle) |
| UAT headless | Web: `scripts/web-uat.sh` / Playwright `chrome-headless-shell`; iOS: `scripts/sim-uat.sh` (AXe + simctl, không `open -a Simulator` / không cliclick) — khớp artifact |
| EAS Cloud Build | Không dùng |
| Deploy prod | Không — đúng ủy quyền (deploy là #133 / PR khác) |
| CI trên SHA | Run [39047240952](https://github.com/hangndat/ticket-solution/actions/runs/39047240952) · `headSha` = tip · `changes` SUCCESS · `ci` SUCCESS · web/mobile/backend/db/d5-* **SKIPPED** (docs-only — hợp lệ) |
| Evidence trên Issue | Comment #131 có exact SHA + lệnh + link artifact (supersedes comment cũ trỏ PR #215 / SHA khác) |

### Spot-check branding (PNG trên SHA)

| Surface | Quan sát reviewer |
| --- | --- |
| Web sunburst | Wordmark/org **Sunburst Collective**; hero accent ấm (sampled ~RGB 176,64,16) |
| Web northline | Wordmark/org **Northline Studio**; palette teal/sage (sampled hero ~RGB 16,64,64) — khác rõ sunburst |
| Web platform | Home **Vemoki** (baseline) |
| iOS demo-fun | `Tổ chức: demo-fun` · **Demo FUN Collective**; card accent xanh (~RGB 32,80,64 ≈ `#245B47`) |
| iOS demo-studio | `Tổ chức: demo-studio` · **Demo Studio Organization**; card accent tím (~RGB 80,64,128 ≈ `#59428A`) |
| iOS slug toggle | `Tenant: demo-studio` sau “Đổi tenant slug” |

## Findings

| Severity | Finding |
| --- | --- |
| Limitation (trong scope — không FAIL) | Chrome/header iOS vẫn wordmark **vemoki** khi branding API không resolve — đã ghi trong UAT artifact; card/org name vẫn khác brand theo fixture ≥2. |
| Limitation (đã biết D8) | Web platform home giữ Vemoki khi chưa gắn tenant slug vào ThemeProvider (#125/#126) — ngoài AC T1 UAT evidence. |
| Nit | Issue #131 còn comment evidence cũ (PR #215 / SHA `04d31c6…` / path `d8-uat/web|ios`) — đã bị comment tip `156ae764…` / PR #216 thay thế; không ảnh hưởng tip đang duyệt. |

Không blocker ownership / secrets / EAS / thiếu ≥2 tenant / thiếu headless / CI đỏ / deploy trái ủy quyền.

## Verdict

**PASS with known gap**

- Gap có chủ đích: iOS chrome wordmark / web platform có thể fallback Vemoki; **không** nuốt AC #131 (screenshot ≥2 tenant brand khác nhau, headless, không EAS).
- Đủ evidence milestone gate (a) Epic #119 / Story #130 cho slice UAT branding.
- Reviewer độc lập implementer (`ctx_c2448785328c` ≠ `ctx_843f06f4b7e5`).
- Merge PR #216 / Project `Hoàn thành` → **coordinator** (reviewer không merge, không đóng Issue).

## Revalidation

Commit hành vi / evidence mới sau SHA `156ae764410235ada2c62f68f00b5718949e66e2` → bắt buộc DoD lại; không kế thừa verdict này.
