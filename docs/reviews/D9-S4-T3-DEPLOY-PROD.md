# D9-S4-T3 — Deploy prod evidence (#149)

**Ngày:** 2026-10-17  
**Story:** [#146](https://github.com/hangndat/ticket-solution/issues/146) · **Task:** [#149](https://github.com/hangndat/ticket-solution/issues/149)  
**Epic:** [#134](https://github.com/hangndat/ticket-solution/issues/134)  
**Base tip (main khi lập artifact):** `b5dd23da6a06c4301c654d2481a08002fe89669e`  
**Ownership:** coordinator / evidence-gate · Role `reviewer-dod` (catalog) · **không** tạo cloud resource / deploy thật khi thiếu ủy quyền

## Authorization check

Issue [#149](https://github.com/hangndat/ticket-solution/issues/149) body:

> SHA + health **khi đã ủy quyền**.

Dispatch comment trên #149:

> **không** tự deploy prod nếu thiếu ủy quyền — ghi N/A có chủ đích + index artifact #147/#148.

| Check | Finding |
| --- | --- |
| Explicit “authorize deploy prod” / “ủy quyền deploy” in #149 | **Absent** (chỉ thu evidence *nếu* đã ủy quyền) |
| Explicit authorize on parent Story #146 | **Absent** (“deploy evidence nếu có” — điều kiện, không phải lệnh deploy) |
| Explicit authorize on Epic #134 | **Absent** (DoD milestone liệt kê deploy evidence như gate; không ủy quyền chạy deploy) |
| ROADMAP §4.1 gate (c) | Deploy prod **chỉ khi** task/coordinator ủy quyền rõ; nếu chưa → ghi “chưa deploy” + lý do |
| AGENTS.md / `git-workflow.mdc` | Không tạo cloud resource / publish production trừ task ủy quyền rõ |
| Task dispatcher | Deploy **ONLY if** authorized — otherwise intentional N/A + DoD index |

## Verdict

**NOT authorized — deploy skipped (N/A có chủ đích).**

Không chạy rsync, `docker compose`, migrate, nginx, hay health-check claim cho một deploy D9 mới.  
Artifact này **không** tuyên bố production deploy cho D9-S4. Không tái dùng [D6-DEPLOY-PROD-2026-10-17.md](./D6-DEPLOY-PROD-2026-10-17.md) như bằng chứng deploy D9 (D6 ≠ D9).

## What was not done

- Không SSH deploy tới host prod / `/opt/vemoki`
- Không ghi SHA deploy + health table cho tip D9
- Không đụng secrets `/opt/vemoki/.env` hay recreate postgres/keycloak

## Artifact DoD index — Story #146

Index nghiệm thu milestone (gates a/b/d đã có; gate c = N/A theo trên):

| Gate | Task | PR | Evidence / review SHA | Merge commit | Artifact |
| --- | --- | --- | --- | --- | --- |
| (a) Headless UAT | [#147](https://github.com/hangndat/ticket-solution/issues/147) Hoàn thành | [#197](https://github.com/hangndat/ticket-solution/pull/197) | Evidence `93fe1291bf792dd0a5927d6f6c5a2d4aa23f4ab4` · DoD `87ba50b` (PASS with known gap) | `86be8ef5fc88d558d14d2adb0c122f0c1632c8fb` | [D9-S4-T1-DEMO-UAT.md](./D9-S4-T1-DEMO-UAT.md) · [D9-S4-T1-DEMO-UAT-DOD.md](./D9-S4-T1-DEMO-UAT-DOD.md) |
| (b) Local iOS build | [#148](https://github.com/hangndat/ticket-solution/issues/148) Hoàn thành | [#198](https://github.com/hangndat/ticket-solution/pull/198) | Evidence `c454354231f0480b8566db486ee2a37a3f394e91` · DoD `d95c715` (PASS) | `b5dd23da6a06c4301c654d2481a08002fe89669e` | [D9-S4-T2-IOS-LOCAL-BUILD.md](./D9-S4-T2-IOS-LOCAL-BUILD.md) · [D9-S4-T2-IOS-LOCAL-BUILD-DOD.md](./D9-S4-T2-IOS-LOCAL-BUILD-DOD.md) |
| (c) Deploy prod | [#149](https://github.com/hangndat/ticket-solution/issues/149) (this) | *(PR của artifact này)* | **N/A — chưa ủy quyền** | — | this file |
| (d) Review artifacts | #147 + #148 | #197 + #198 | Exact-SHA DoD trên các SHA trên | merged | `docs/reviews/D9-S4-T*` |

Curated UAT PNGs: `docs/reviews/d9-uat/s4-t1/{web,ios}/` (từ #147).

## If authorize later

1. Ủy quyền rõ trên Issue/Epic (hoặc lệnh coordinator) trước khi chạy `.cursor/skills/deploy-prod/SKILL.md`.
2. Ghi exact deploy SHA + health (`https://vemoki.com/` / `https://api.vemoki.com/v1/health`).
3. DoD revalidation trên SHA deploy mới — không kế thừa verdict N/A này.

## Checks (docs-only)

- Đọc Issue #149 / #146 / #134, ROADMAP §4.1.3, comment dispatch #149.
- Đối chiếu merge SHAs PR #197 / #198 trên `origin/main` tip `b5dd23da6a06c4301c654d2481a08002fe89669e`.
- **Không** chạy runtime deploy / health prod trong task này.
