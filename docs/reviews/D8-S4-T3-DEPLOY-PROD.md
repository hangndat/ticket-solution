# D8-S4-T3 — Deploy prod evidence (#133)

**Ngày:** 2026-10-17  
**Story:** [#130](https://github.com/hangndat/ticket-solution/issues/130) · **Task:** [#133](https://github.com/hangndat/ticket-solution/issues/133)  
**Epic:** [#119](https://github.com/hangndat/ticket-solution/issues/119)  
**Base tip (main khi lập artifact):** `361deddeea7a83e628ece69d9ed6307d08fc7468`  
**Ownership:** docs/reviews evidence-gate · Role `backend` (catalog, docs-only) · **không** tạo cloud resource / deploy thật khi thiếu ủy quyền

## Authorization check

Issue [#133](https://github.com/hangndat/ticket-solution/issues/133) body:

> SHA + health; **chỉ khi đã ủy quyền.**

Dispatch Task #133:

> Document NOT authorized deploy skip … **No actual deploy.** Deploy authorized: **it is NOT**.

| Check | Finding |
| --- | --- |
| Explicit “authorize deploy prod” / “ủy quyền deploy” in #133 | **Absent** (chỉ thu evidence *nếu* đã ủy quyền) |
| Explicit authorize on parent Story #130 | **Absent** (“deploy evidence” trong milestone gate — điều kiện, không phải lệnh deploy) |
| Explicit authorize on Epic #119 | **Absent** (DoD Epic liệt kê milestone gate; không ủy quyền chạy deploy) |
| ROADMAP §4.1 gate (c) | Deploy prod **chỉ khi** task/coordinator ủy quyền rõ; nếu chưa → ghi “chưa deploy” + lý do |
| AGENTS.md / `git-workflow.mdc` | Không tạo cloud resource / publish production trừ task ủy quyền rõ |
| Task dispatcher | Deploy **NOT** authorized — intentional N/A + artifact |

## Verdict

**NOT authorized — deploy skipped (N/A có chủ đích).**

Không chạy rsync, `docker compose`, migrate, nginx, hay health-check claim cho một deploy D8 mới.  
Artifact này **không** tuyên bố production deploy cho D8-S4. Không tái dùng [D6-DEPLOY-PROD-2026-10-17.md](./D6-DEPLOY-PROD-2026-10-17.md) như bằng chứng deploy D8 (D6 ≠ D8). Không kế thừa [D7-S4-DEPLOY-PROD.md](./D7-S4-DEPLOY-PROD.md) / [D9-S4-T3-DEPLOY-PROD.md](./D9-S4-T3-DEPLOY-PROD.md) như deploy D8.

## What was not done

- Không SSH deploy tới host prod / `/opt/vemoki`
- Không ghi SHA deploy + health table cho tip D8
- Không đụng secrets `/opt/vemoki/.env` hay recreate postgres/keycloak
- Không claim `https://vemoki.com/` / `https://api.vemoki.com/v1/health` cho deploy D8

## Artifact DoD index — Story #130

Index nghiệm thu milestone (gate c = N/A theo trên; gates a/b đang song song khi lập artifact):

| Gate | Task | PR | Evidence / review SHA | Merge commit | Artifact |
| --- | --- | --- | --- | --- | --- |
| (a) Headless UAT | [#131](https://github.com/hangndat/ticket-solution/issues/131) | *(chưa có PR evidence khi lập)* | **Pending** — worker đang làm | — | *(chờ artifact T1)* |
| (b) Local iOS build | [#132](https://github.com/hangndat/ticket-solution/issues/132) | *(chưa có PR evidence khi lập)* | **Pending** — worker đang làm | — | *(chờ artifact T2)* |
| (c) Deploy prod | [#133](https://github.com/hangndat/ticket-solution/issues/133) (this) | *(PR của artifact này)* | **N/A — chưa ủy quyền** | — | this file |
| (d) Review artifacts | #131 + #132 (+ this) | *(khi có)* | Exact-SHA DoD trên SHA tip từng PR | *(khi merge)* | `docs/reviews/D8-S4-T*` |

Coordinator cập nhật hàng (a)/(b)/(d) khi #131/#132 có evidence + DoD; **không** đổi verdict gate (c) trừ khi có ủy quyền deploy mới.

## If authorize later

1. Ủy quyền rõ trên Issue/Epic (hoặc lệnh coordinator) trước khi chạy `.cursor/skills/deploy-prod/SKILL.md`.
2. Ghi exact deploy SHA + health (`https://vemoki.com/` / `https://api.vemoki.com/v1/health`).
3. DoD revalidation trên SHA deploy mới — không kế thừa verdict N/A này.

## Checks (docs-only)

- Đọc Issue #133 / #130 / #119, ROADMAP §4.1.3, dispatch Task #133.
- Đối chiếu pattern [D7-S4-DEPLOY-PROD.md](./D7-S4-DEPLOY-PROD.md) + [D9-S4-T3-DEPLOY-PROD.md](./D9-S4-T3-DEPLOY-PROD.md).
- Base tip `origin/main` = `361deddeea7a83e628ece69d9ed6307d08fc7468` khi lập.
- **Không** chạy runtime deploy / health prod trong task này.
