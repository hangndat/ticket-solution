# D10-S5-T3 — Deploy prod evidence (#166)

**Ngày:** 2026-10-17  
**Story:** [#163](https://github.com/hangndat/ticket-solution/issues/163) · **Task:** [#166](https://github.com/hangndat/ticket-solution/issues/166)  
**Epic:** [#150](https://github.com/hangndat/ticket-solution/issues/150)  
**Base tip (main khi lập artifact):** `361deddeea7a83e628ece69d9ed6307d08fc7468`  
**Ownership:** coordinator / evidence-gate · Role `reviewer-dod` (catalog) · **không** tạo cloud resource / deploy thật khi thiếu ủy quyền

## Authorization check

Issue [#166](https://github.com/hangndat/ticket-solution/issues/166) body:

> SHA + health; hoặc N/A có lý do.

Dispatch task (Orca):

> Deploy prod **chưa ủy quyền** → artifact N/A (giống D9-S4-T3 / D8-S4-T3). **KHÔNG** deploy prod. Chỉ `docs/reviews`.

| Check | Finding |
| --- | --- |
| Explicit “authorize deploy prod” / “ủy quyền deploy” in #166 | **Absent** (cho phép N/A có lý do; không lệnh deploy) |
| Explicit authorize on parent Story #163 | **Absent** (“deploy evidence nếu trong scope” — điều kiện, không phải lệnh deploy) |
| Explicit authorize on Epic #150 | **Absent** (ASC prep / milestone gate; ngoài phạm vi: submit store; không ủy quyền deploy VPS) |
| ROADMAP / Project gate (c) | Deploy prod **chỉ khi** task/coordinator ủy quyền rõ; nếu chưa → ghi “chưa deploy” + lý do |
| AGENTS.md / `git-workflow.mdc` | Không tạo cloud resource / publish production trừ task ủy quyền rõ |
| Task dispatcher | Deploy **không** chạy — intentional N/A + index Story #163 |

## Verdict

**NOT authorized — deploy skipped (N/A có chủ đích).**

Không chạy rsync, `docker compose`, migrate, nginx, hay health-check claim cho một deploy D10 mới.  
Artifact này **không** tuyên bố production deploy cho D10-S5. Không tái dùng [D6-DEPLOY-PROD-2026-10-17.md](./D6-DEPLOY-PROD-2026-10-17.md) hay [D9-S4-T3-DEPLOY-PROD.md](./D9-S4-T3-DEPLOY-PROD.md) như bằng chứng deploy D10 (D6/D9 ≠ D10).

## What was not done

- Không SSH deploy tới host prod / `/opt/vemoki`
- Không ghi SHA deploy + health table cho tip D10
- Không đụng secrets `/opt/vemoki/.env` hay recreate postgres/keycloak

## Artifact DoD index — Story #163

Index nghiệm thu milestone (gate c = N/A theo trên; sibling T1/T2 còn mở trên board):

| Gate | Task | PR | Evidence / review SHA | Merge commit | Artifact |
| --- | --- | --- | --- | --- | --- |
| (a) Headless UAT / ASC checklist | [#164](https://github.com/hangndat/ticket-solution/issues/164) Đang làm | — | **Chưa land** trên Story #163 | — | *(chờ T1)* · related ASC docs: [D10-ASC-S1-S3-METADATA.md](./D10-ASC-S1-S3-METADATA.md) |
| (b) Local iOS build | [#165](https://github.com/hangndat/ticket-solution/issues/165) Sẵn sàng | — | **Chưa land** trên Story #163 | — | *(chờ T2)* · related S4: [D10-S4-T1-ARCHIVE.md](./D10-S4-T1-ARCHIVE.md) (`81b45db`) · [D10-S4-T2-TESTFLIGHT-PREP.md](./D10-S4-T2-TESTFLIGHT-PREP.md) (`9d2d9f7`) |
| (c) Deploy prod | [#166](https://github.com/hangndat/ticket-solution/issues/166) (this) | *(PR của artifact này)* | **N/A — chưa ủy quyền** | — | this file |
| (d) Review artifacts | #164 + #165 + #166 | — | Exact-SHA DoD khi từng Task Chờ duyệt | — | `docs/reviews/D10-S5-T*` (+ S4 related trên main) |

**Lưu ý index:** Gate (a)/(b) của Story #163 **chưa** Hoàn thành tại thời điểm artifact T3; bảng ghi trạng thái trung thực, không claim UAT/archive S5 đã merge. Evidence S4 (#161/#162) trên `main` tip `361deddeea7a83e628ece69d9ed6307d08fc7468` chỉ là related, không thay DoD S5-T1/T2.

## If authorize later

1. Ủy quyền rõ trên Issue/Epic (hoặc lệnh coordinator) trước khi chạy `.cursor/skills/deploy-prod/SKILL.md`.
2. Ghi exact deploy SHA + health (`https://vemoki.com/` / `https://api.vemoki.com/v1/health`).
3. DoD revalidation trên SHA deploy mới — không kế thừa verdict N/A này.

## Checks (docs-only)

- Đọc Issue #166 / #163 / #150, dispatch Orca “không deploy”, mẫu D9-S4-T3 / D7-S4.
- Đối chiếu tip `origin/main` = `361deddeea7a83e628ece69d9ed6307d08fc7468`; PR #204/#205 merge SHAs cho related S4.
- **Không** chạy runtime deploy / health prod trong task này.
