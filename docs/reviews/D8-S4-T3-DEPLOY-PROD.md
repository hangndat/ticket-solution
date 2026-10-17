# D8-S4-T3 — Deploy prod evidence (#133)

**Ngày:** 2026-10-17  
**Story:** [#130](https://github.com/hangndat/ticket-solution/issues/130) · **Task:** [#133](https://github.com/hangndat/ticket-solution/issues/133)  
**Epic:** [#119](https://github.com/hangndat/ticket-solution/issues/119)  
**Base tip (main khi lập artifact):** `361deddeea7a83e628ece69d9ed6307d08fc7468`  
**Ownership:** coordinator / evidence-gate · Role `reviewer-dod` (catalog — evidence/docs) · **không** tạo cloud resource / deploy thật khi thiếu ủy quyền  
**Mẫu tham chiếu:** [D9-S4-T3-DEPLOY-PROD.md](./D9-S4-T3-DEPLOY-PROD.md)

## Authorization check

Issue [#133](https://github.com/hangndat/ticket-solution/issues/133) body:

> SHA + health; **chỉ khi đã ủy quyền**.

Parent Story [#130](https://github.com/hangndat/ticket-solution/issues/130):

> UAT headless theming đa tenant + iOS local build + **deploy evidence**.

| Check | Finding |
| --- | --- |
| Explicit “authorize deploy prod” / “ủy quyền deploy” in #133 | **Absent** (chỉ thu evidence *khi* đã ủy quyền) |
| Explicit authorize on parent Story #130 | **Absent** (“deploy evidence” — thu thập bằng chứng, không phải lệnh deploy) |
| Explicit authorize on Epic #119 | **Absent** (white-label Epic; không ủy quyền chạy deploy) |
| ROADMAP §4.1 gate (c) | Deploy prod **chỉ khi** task/coordinator ủy quyền rõ; nếu chưa → ghi “chưa deploy” + lý do |
| ROADMAP § D8 | Không store submit trong D8; Gate §4.1 áp dụng |
| AGENTS.md / `git-workflow.mdc` | Không tạo cloud resource / publish production trừ task ủy quyền rõ |
| Task dispatcher (Orca) | Deploy **chưa được ủy quyền** cho D8 → ghi N/A có chủ đích; **không** chạy deploy |

## Verdict

**NOT authorized — deploy skipped (N/A có chủ đích).**

Không chạy rsync, `docker compose`, migrate, nginx, hay health-check claim cho một deploy D8 mới.  
Artifact này **không** tuyên bố production deploy cho D8-S4. Không tái dùng [D6-DEPLOY-PROD-2026-10-17.md](./D6-DEPLOY-PROD-2026-10-17.md) như bằng chứng deploy D8 (D6 ≠ D8). Không kế thừa N/A/D9 như bằng chứng D8 (D9 ≠ D8).

## What was not done

- Không SSH deploy tới host prod / `/opt/vemoki`
- Không ghi SHA deploy + health table cho tip D8
- Không đụng secrets `/opt/vemoki/.env` hay recreate postgres/keycloak
- Không sửa `apps/**` / infra deploy scripts trong task này

## Artifact DoD index — Story #130

Index nghiệm thu milestone (gate c = N/A theo trên; a/b còn mở trên board tại thời điểm lập artifact):

| Gate | Task | Status (board) | Evidence / review SHA | Artifact |
| --- | --- | --- | --- | --- |
| (a) Headless UAT | [#131](https://github.com/hangndat/ticket-solution/issues/131) | OPEN / chưa đóng T1 | *(chưa land — theo dõi #131)* | *(pending T1)* |
| (b) Local iOS build | [#132](https://github.com/hangndat/ticket-solution/issues/132) | OPEN / chưa đóng T2 | *(chưa land — theo dõi #132)* | *(pending T2)* |
| (c) Deploy prod | [#133](https://github.com/hangndat/ticket-solution/issues/133) (this) | artifact này | **N/A — chưa ủy quyền** | this file |
| (d) Review artifacts | #131 + #132 + #133 | partial | Exact-SHA DoD khi từng Task Chờ duyệt / merge | `docs/reviews/D8-S4-T*` |

Ghi chú: gate (c) N/A **không** bị chặn bởi T1/T2 còn mở — lý do skip là thiếu ủy quyền deploy, không phải thiếu UAT/build.

## If authorize later

1. Ủy quyền rõ trên Issue/Epic (hoặc lệnh coordinator) trước khi chạy `.cursor/skills/deploy-prod/SKILL.md`.
2. Ghi exact deploy SHA + health (`https://vemoki.com/` / `https://api.vemoki.com/v1/health`).
3. DoD revalidation trên SHA deploy mới — không kế thừa verdict N/A này.

## Checks (docs-only)

- Đọc Issue #133 / #130 / #119, ROADMAP §4.1 item 3 + mục D8, mẫu D9-S4-T3.
- Base tip `origin/main` = `361deddeea7a83e628ece69d9ed6307d08fc7468` (`git rev-parse` sau fetch).
- **Không** chạy runtime deploy / health prod trong task này.

## DoD self-check (implementer / evidence author)

> Self-check của worker tạo artifact — **không** thay DoD reviewer độc lập (session ≠ implementer) theo `github-project-tracking.mdc` / `docs/agents/roles/reviewer-dod.md`. Coordinator spawn reviewer riêng sau khi PR ở `Chờ duyệt`.

| Check | Result |
| --- | --- |
| Scope ownership | Chỉ `docs/reviews/D8-S4-T3-DEPLOY-PROD.md` — không sửa `apps/**` |
| Secrets | Không secret / credential / `.env` nội dung / SSH key |
| Tự deploy | **Không** — không SSH/rsync/compose/migrate/nginx/health prod |
| Ủy quyền deploy | **Absent** trên #133 / #130 / #119 — khớp dispatch N/A |
| ROADMAP §4.1 (c) | “chưa deploy” + lý do — đúng chính sách |
| Exact SHA tip (sau commit) | Điền trên Issue/PR comment = `git rev-parse HEAD` của commit artifact |
| Independent DoD | **Pending** — reviewer Cursor khác session implementer |
| Verdict self-check | Evidence N/A đủ điều kiện đưa `Chờ duyệt`; merge/`Hoàn thành` sau DoD độc lập + CI |

## Revalidation

Nếu sau này có ủy quyền deploy thật → artifact + DoD trên SHA deploy mới bắt buộc; không kế thừa N/A này.
