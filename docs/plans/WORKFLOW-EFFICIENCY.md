# Gói siết workflow — planning, review, token

Ngày đo: **27/10/2026** · Triển khai cùng ngày trên nhánh `hangndat/tooling-workflow-efficiency`. Không mở GitHub Issue/Epic.  
Authority: file này (local). Làm xong gói này **trước** feature/product khác.

Architecture impact: **Không** (quy trình + hygiene repo; không đổi contract/auth/RLS).  
Cost mặc định khi triển khai: `standard` (Composer). Không spawn planner. Không reviewer độc lập cho chính gói docs/tooling này — coordinator tự kiểm + CI `git diff --check` nếu có PR.

## 0. Kết luận

| Câu hỏi | Trả lời |
| --- | --- |
| Planning quá mịn? | **Có.** Epic→Story→Task đúng; sai là mỗi Task = spawn + spec + Persona + board + review + `docs/reviews`. |
| Review quá nhiều? | **Có trên hạt Task.** Cần độc lập ở PR rủi ro (auth/tenant/vé/check-in/migration/store). Không cần cho docs/tooling/copy/CSS theo spec đã chốt. |
| Token lãng phí? | **Có, P0 host:** 56 worktree → Cursor inject ~13 requestable rules × 56 (~58k tok/prompt). Rules alwaysApply đã gọn (~6.8k). |
| Output chậm vì đâu? | Đường găng nối tiếp (implement → review → fix → revalidate) + sai mapping model (`thinking-low` / Codex `high` cho UI) + fail rồi spawn lại. |

Ba lớp `code complete ≠ acceptance ≠ pilot ready` **giữ ở Epic phát hành**. Không áp đủ 5 cổng DoD xuống mọi Task.

---

## 1. Bảng thống kê chi tiết

Ước lượng token = bytes / 3.5 (disk), **không** phải billed quota Cursor. Telemetry per-task nhiều chỗ `unknown`.

### 1.1 Context mỗi prompt Cursor (host)

| Thành phần | Bytes / số đo | ~Token | Chủ đích? | Ghi chú |
| --- | ---: | ---: | --- | --- |
| Worker alwaysApply + AGENTS + user always | 23 768 B | ~6 800 | Có | `orca-context-budget.mjs --user-rules` 27/10 |
| Coordinator requestable (1 bản) | 62 574 B | ~17 900 | Có nếu Read | Không nên nhồi mọi prompt |
| Requestable × **56 worktree** | ~204 000 ký tự metadata | **~58 000** | **Không** | 13 rule × 56 wt × ~280 ký tự/dòng |
| Skills catalog (metadata prompt) | — | ~8 500 | Một phần | context-budget.md; chưa Read SKILL.md |
| CRG + lean-ctx + tool schemas | — | ~9 000+ | Có, lặp mỗi turn | Graph stale vs `main` (build `30a8ff8a`, head khác) |
| **Tổng tĩnh trước câu hỏi user** | — | **~80 000** | — | ~70% là nhân bản worktree |

| Git worktree còn sống | 56 |
| --- | ---: |
| AlwaysApply repo | 5 file |
| Requestable repo | 15 file |
| Ước bản sao path trong prompt | 728 |

### 1.2 Khối lượng repo — code vs râu ria

| Hạng mục | Số đo | Ý nghĩa |
| --- | --- | --- |
| LOC product (`apps`/`packages`, trừ test) | 152 069 | Output sản phẩm |
| LOC test | 51 318 | Hợp lý so với product |
| `docs/` tổng | 316 288 KB (~316 MB) | Lớn hơn code rất nhiều vì binary |
| `docs/reviews` | 291 528 KB | Gần hết docs |
| `docs/reviews/*.md` | 549 file, 3 056 984 B (~3 MB) | Báo cáo DoD |
| `docs/reviews` PNG/JPEG/WebP | 1 114 ảnh, ~286 MB | Evidence UAT **trong git** |
| `docs/reviews/*.json` | 544 | Packet/manifest |
| `docs/plans` | 44 file, 948 KB | Kế hoạch |
| `docs/agents` | 384 KB | Catalog/role — giữ |
| `docs/design` | ~22 MB | Design — giữ khi còn hiệu lực |
| `.cursor/rules` | 112 KB | Đã refactor gọn |

`.gitignore` chỉ loại một glob PNG hẹp (`docs/reviews/assets/FE-DS-SLICE0-parity-*/*.png`), không chặn 1 114 ảnh còn lại.

### 1.3 Git tháng 10/2026 (`--since=2026-10-01`)

| Chỉ số | Giá trị |
| --- | ---: |
| Tổng commit | 1 385 |
| Commit đụng `docs/reviews` | 601 |
| Commit đụng `apps`/`packages` | 615 |
| Commit docs khác reviews | 208 |
| Commit `.cursor/rules` + `docs/agents` | 59 |
| Path-touch `reviews` | 3 018 |
| Path-touch `web` | 1 684 |
| Path-touch `mobile` | 1 141 |
| Path-touch `backend` | 629 |
| Path-touch `portal` | 512 |

Tỷ lệ commit reviews : product ≈ **1 : 1**. Không chứng minh 50% thời gian là review, nhưng chứng minh artifact quy trình được commit dày như code.

### 1.4 Ledger worker (`company/work-events.jsonl`)

Mẫu nhỏ (chủ yếu run Issue #869/#870, 24–25/10). Không ngoại suy cả tháng.

| Chỉ số | Giá trị |
| --- | --- |
| Dispatch có assigned | 14 |
| Settled | 14 (11 completed, 3 failed) |
| Interrupted | 1 |
| Recovered | 1 |
| Review độc lập FAIL | 2 (cùng Issue #869) |
| Thời gian assigned→settled | n=13; median **6.7 phút**; mean 9.5; max 23.7 |

| Dispatch (rút) | Model requested | Phút | Outcome |
| --- | --- | ---: | --- |
| Noah backend tooling | `composer-2.5` | 2.5–3.1 | completed |
| James reviewer-dod tooling | `composer-2.5` | 1.4 | completed (quá nhanh — tín hiệu review hình thức) |
| Liv PD / Linh web | `claude-sonnet-5-thinking-low` (Cursor) | 14–16 | completed; 1 interrupted 0.2 phút |
| James dod+sec+ux | `gpt-6-sol` **high** | 20.1 | FAIL |
| James revalidate | `gpt-6-sol` **high** | 6.7 | FAIL, hết 2/2 + ngoại lệ |
| Linh web claim | `gpt-6-sol` **high** | 23.7 | failed |
| Linh web lần sau | `gpt-6-sol` **high** | 14.3 | completed |

Lệch catalog: Cursor không được vượt `standard`; cấm Sonnet-thinking trên Cursor; UI thường lệ = Composer `standard`, không Codex `high`.

### 1.5 Đường găng một Story nhỏ (ước lượng quy trình, không phải giờ billed)

| Bước | % đường găng | Bắt buộc hôm nay? | Nên bắt buộc? |
| --- | ---: | --- | --- |
| BA / PD / planner trước code | 25 | Thường có (cổng D11, planner/Epic) | Chỉ khi AC UI hoặc DAG đa owner chưa chốt |
| Implement | 20 | Có | Có |
| Review + fix + revalidate | 35 | Mọi Task (5 cổng DoD) | Chỉ PR rủi ro; tối đa 1 review/PR |
| Evidence md/png/packet + Project comment | 20 | Mọi Task | Comment PR hoặc CI artifact; md ≤ ~40 dòng |

5 cổng DoD hiện tại mỗi Task: reviewer ≠ implementer · merge `main` · CI · evidence khớp AC · artifact SHA.

---

## 2. Đánh giá việc cần làm

Ưu tiên: P0 chặn token/host và quy trình đang đẻ Task; P1 đổi hạt planning/review; P2 dọn artifact.  
Cột **Làm** = có mặt trong gói này.

| ID | Việc | P | Làm | Lý do | Không làm trong gói |
| --- | --- | --- | --- | --- | --- |
| W1 | Prune git worktree đã merge/xong; Cursor chỉ mở **một root** | P0 | Có | Cắt ~58k tok/prompt ngay; không đụng product | Không xóa wt `Đang làm` / PR mở |
| W2 | Sửa rule: đơn vị ship = Story/PR; Task chỉ khi conflict slice/contract | P0 | Có | Hết xé mịn | Không xóa hierarchy Epic→Story trên board cũ |
| W3 | Planner chỉ khi DAG ≥2 owner hoặc dep artifact thật | P0 | Có | Tránh session Dexter cho việc 1 PR | Không cấm planner Epic lớn |
| W4 | BA/PD không mặc định trước coding | P1 | Có | Cổng D11 chỉ khi Visual budget / AC UI mở | Không bỏ PD cho revamp |
| W5 | DoD: docs/tooling = implementer + CI; product rủi ro = 1 review/PR | P0 | Có | Cắt review hình thức | Không bỏ reviewer độc lập cho auth/vé/tenant |
| W6 | Gộp dod+sec+ux một session trên cùng SHA (đã có rule — siết thực thi) | P1 | Có | Tránh 3 reviewer | Không đối chứng 2 model |
| W7 | Siết cost-catalog trong spawn: Composer `standard` cho UI/docs; cấm thinking-low / Codex high cho UI thường | P0 | Có | #869 đốt high sai chỗ | Không đổi pin catalog trừ dòng cấm thực thi |
| W8 | Evidence: không commit PNG hàng loạt; report ngắn; comment PR | P1 | Có | 286 MB git | Không xóa lịch sử ảnh đã merge (tách task dọn LFS/gitignore) |
| W9 | Gitignore (hoặc LFS) cho `docs/reviews/**/*.png` mới | P1 | Có | Chặn phình tiếp | Không rewrite history |
| W10 | CRG/lean-ctx: giữ exempt docs; không rebuild graph cho Q&A | P2 | Có | Round-trip phí, compose authority fail | Không đổi MCP server |
| W11 | Coordinator session ngắn; checkpoint rồi session mới | P2 | Docs only | Transcript phình | Không đo được bằng PR |
| W12 | Fail/recover: không spawn lại khi chưa có nguyên nhân | P2 | Có (1 đoạn rule) | 21% settle fail trên mẫu | Không viết retry engine |
| W13 | Epic GitHub + Project #3 | — | **Không** | User chốt local md | — |
| W14 | Feature product / portal / iOS | — | **Không** | Bị chặn đến khi gói này xong | — |

**Giữ nguyên (không “tối ưu” bằng cách bỏ):**

- Reviewer ≠ implementer với auth, tenant/RLS, vé/tiền/check-in, race/idempotency, migration, store/prod.
- Trần 2 lượt fix + ngắt (`orca-review-convergence`).
- Composer mặc định cheap/standard; `high` cần `--tier-reason`.
- `worker_done` ≠ Hoàn thành ở **Epic phát hành**.

---

## 3. Epic local (không lên GitHub)

**Tên:** Siết workflow Orca — hạt Story, review theo rủi ro, dọn context.  
**Owner:** coordinator (docs/rules) · **Checkout:** `main` root, **không** tạo 56 worktree mới.  
**Ngoài phạm vi:** product feature, deploy, store, đổi auth, spawn Orca planner.

Thứ tự bắt buộc: **S0 → S1 → S2 → S3**. Không song song S1 với feature khác.

### S0 — kết quả 27/10/2026

`git worktree list`: **56 → 16**. Đã `remove` wt merged (kể cả dirty leftover). Còn 16 = `main` + 2 PR mở (`vcx-938-cs-export`, `vcx-940-staff`) + 13 branch chưa merge vào `origin/main`. Trần ≤8 chưa đạt vì các wt chưa merge; không xóa work đang dở. Cursor: đóng folder `vcx-*` trong workspace nếu còn (host UI).

### S0 — Dọn host (P0, ngay, có thể làm không PR)

| Task | Việc | AC | Check |
| --- | --- | --- | --- |
| S0-T1 | Liệt kê `git worktree list`; gắn Issue/PR còn mở vs đã merge | Bảng: path, branch, PR merged? agent live? | `git worktree list` |
| S0-T2 | `git worktree remove` các wt an toàn (merged, không dirty cần giữ, không agent live) | Số wt giảm rõ; `main` giữ | `git worktree list \| wc -l` trước/sau |
| S0-T3 | Cursor: workspace chỉ root repo, **không** add folder `vcx-*` | Prompt không còn 13 rule × N wt | Quan sát `agent_requestable_workspace_rules` (một cụm path) |

### S1 — Đổi hạt planning + DoD (P0, một PR docs/rules)

Paths: `.cursor/rules/github-project-tracking.mdc`, `orca-epic-orchestrator.mdc`, `orca-parallel-workers.mdc`, `orca-agent-routing-coordinator.mdc`, `docs/agents/context-budget.md` (mục vận hành), `AGENTS.md` (đoạn ownership/DoD ngắn).

| Task | Việc | AC |
| --- | --- | --- |
| S1-T1 | Đơn vị ship mặc định = **một Story / một PR / một owner**. Task chỉ khi khác slice hoặc thiếu contract/PD | Rule ghi rõ; ví dụ D6-style 3 PR docs/web/iOS không mặc định |
| S1-T2 | Planner: chỉ Epic có ≥2 owner **và** dep artifact thật; task lẻ/docs/tooling coordinator **inline** | Câu “một planner / Epic” đổi thành điều kiện |
| S1-T3 | Hoàn thành Task: **nhánh A** docs/tooling/copy/test-không-đổi-hành-vi = implementer + CI (+ comment SHA). **Nhánh B** product rủi ro = 1 reviewer độc lập / PR (gộp dod±sec±ux) | Bảng 2 nhánh trong `github-project-tracking.mdc` |
| S1-T4 | 3 lớp complete chỉ bắt buộc ở Epic phát hành / store / prod UAT | ROADMAP §1.1 không bị xóa; thêm “không áp xuống Task docs” |

Review PR S1: **không** spawn James. Coordinator đọc diff rules.

### S2 — Routing model + evidence (P0/P1, cùng PR với S1 nếu gọn)

| Task | Việc | AC |
| --- | --- | --- |
| S2-T1 | Preflight/spawn: UI/docs/tests → Composer `standard`; cấm `claude-sonnet-5-thinking-*` trên Cursor; Codex/Claude `high` chỉ khi khớp tiêu chí high | `cost-catalog.md` + `agent-cost-tiers.mjs` (nếu thiếu guard) |
| S2-T2 | Reviewer UI thường: Composer hoặc Claude `focused`, không `gpt-6-sol high` | Một câu trong routing-coordinator |
| S2-T3 | Artifact DoD: ưu tiên comment Issue/PR; `docs/reviews/*.md` ≤ ~40 dòng hoặc bỏ nếu comment đủ | `reviewer-dod.md` + tracking |
| S2-T4 | `.gitignore` `docs/reviews/**/*.png` (và webp/jpg) **file mới**; không `git rm --cached` hàng loạt trừ khi user yêu cầu dọn | Ảnh mới không stage được |

### S3 — Gate tool + fail policy (P2, có thể cùng PR)

| Task | Việc | AC |
| --- | --- | --- |
| S3-T1 | CRG: docs/Q&A exempt đã có — nhắc 1 dòng AGENTS “không gọi list_graph_stats cho gói rules-only” | Worker docs không rebuild graph |
| S3-T2 | Fail dispatch: ghi nguyên nhân; cấm `worker-start` lại cùng task trong 1 wave nếu chưa có giả thuyết mới | 1 đoạn mailbox/routing |
| S3-T3 | Worktree hygiene: sau merge + Hoàn thành, dọn wt trong cùng checkpoint (đã có §4 — thêm “cấm để 50+ wt sống”) | Số wt sau Epic feature < ngưỡng (đề xuất ≤8: main + live) |

---

## 4. Thứ tự thực thi đề xuất

```text
S0-T1 → S0-T2 → S0-T3     (local, hôm nay)
S1-T1…T4 + S2-T1…T4 + S3  (một nhánh docs/rules, một PR)
merge main
→ mới mở feature product khác
```

Không tạo worktree `vcx-workflow-*` trừ khi PR rules cần CI. Làm trên branch `hangndat/tooling-workflow-efficiency` từ `main`.

---

## 5. Acceptance gói (local)

Gói **xong** khi:

1. `git worktree list` còn tập sống gắn PR/Issue mở; Cursor workspace 1 root.
2. Rules S1–S3 đã merge `main` (hoặc user chấp nhận diff local nếu chưa ủy quyền PR).
3. Một Task docs/tooling mới **không** còn yêu cầu reviewer độc lập trong rule.
4. Một Task auth/check-in **vẫn** yêu cầu reviewer độc lập trên PR.
5. PNG mới trong `docs/reviews` không vào git (gitignore).

**Không** tuyên bố giảm X% quota Cursor — chưa có billed telemetry per-task.

---

## 6. Nguồn số

- `node scripts/orca-context-budget.mjs --user-rules` (27/10/2026)
- `git worktree list` → 56
- `git log --since=2026-10-01`
- `find docs/reviews` (ext, bytes)
- `company/work-events.jsonl`
- `.cursor/rules/orca-epic-orchestrator.mdc`, `github-project-tracking.mdc`, `docs/agents/cost-catalog.md`, `docs/ROADMAP.md` §1.1

Giới hạn: CRG graph lệch SHA `main`; lean-ctx `ctx_compose` báo ngoài authority trên một số call — số LOC/docs lấy từ git/find, không từ graph.
