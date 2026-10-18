# BA — Taxonomy metric hiệu quả Role catalog

**Spike:** [Agent Role Effectiveness Monitor](./README.md)  
**Role:** `product-ba` · Architecture impact: **Có** (định nghĩa metric ảnh hưởng telemetry / privacy / attribution; **không** implement)  
**Ngày:** 2026-10-18  
**Nguồn neo:** `docs/agents/README.md`, `.cursor/rules/github-project-tracking.mdc` § đo nhẹ / WIP, Orca reality (`worker-list` chưa có token/CPU per role)

---

## 1. Problem / outcome

**Persona vận hành:** coordinator gốc + chủ repo (Hang) cần biết *role nào đang tốn kém / chậm / kém chất lượng* trong Orca + Cursor — không chỉ “agent chạy xong”.

**Pain:** hiện có lifecycle Dispatch và Status Project #3, nhưng **không** có số đo gắn Role ID → khó so sánh BA vs BE vs reviewer, dễ tối ưu sai (cắt token khi bottleneck thật là hàng đợi duyệt).

**Outcome mong muốn (nghiên cứu):** một taxonomy dùng chung để các file spike 02–07 và `00-synthesis` map cùng ngôn ngữ metric, có MVP đo được bằng proxy hiện có, và non-goals rõ để tránh dashboard SaaS sớm.

---

## 2. Định nghĩa “hiệu quả” (theo role, không gộp một số)

**Hiệu quả của một Role** = khả năng hoàn thành **đầu ra bắt buộc của role đó** với:

| Trục | Ý nghĩa | Không đồng nghĩa với |
| ---- | ------- | -------------------- |
| **Outcome quality** | Artifact đúng scope, AC/DoD/evidence đủ, ít reopen | “Token thấp” |
| **Cost efficiency** | Chi phí inference / thời gian wall-clock hợp lý cho loại Task | “Chạy nhanh bằng cách bỏ review” |
| **Host efficiency** | RAM/CPU/simulator/DB không lãng phí ngoài ownership | “Ít process” khi parallel-first hợp lệ |
| **Process health** | Đóng góp tích cực vào WIP / hàng đợi duyệt / idle-fill | “Nhiều `worker_done`” |

**Công thức tư duy (không phải KPI cứng):**

```text
Effectiveness(role) ≈ Quality(role outcomes)
                      / (Cost_proxy + Host_proxy + Process_penalty)
```

- **Quality** và **Process_penalty** phải **role-specific** (xem §5).
- **Cost** và **Host** dùng chung đơn vị để so sánh công bằng (§6), nhưng **không** xếp hạng role bằng một leaderboard token — vì Task BA docs ≠ Task BE migration.

**Phân biệt bắt buộc với Project:**

| Sự kiện | Ý nghĩa |
| ------- | ------- |
| Orca `worker_done` / Dispatch settled | Worker hết việc được giao — **không** = hiệu quả cao |
| Project `Hoàn thành` | DoD + evidence + (merge/CI khi cần) — gần outcome quality hơn |
| Milestone / Epic đóng | Thêm gate UAT headless / iOS local build / review SHA — ngoài per-role MVP |

---

## 3. Bốn lớp metric (toàn hệ)

### 3.1 Cost / token (và proxy khi thiếu meter)

| Metric ID | Định nghĩa | Nguồn khả thi hôm nay | Ghi chú |
| --------- | ---------- | --------------------- | ------- |
| `cost.tokens_in_out` | Input + output tokens / Dispatch (hoặc / Role-attribution window) | **Chưa có** trong `worker-list` | Cần telemetry Cursor/Orca hoặc log provider (spike architect / BE) |
| `cost.usd_est` | Ước lượng $ theo model × tokens | Phụ thuộc `cost.tokens_*` + bảng giá | Chỉ ước lượng; ghi model ID |
| `cost.wall_ms` | Thời gian từ `worker-start` → settlement | Orca Dispatch timestamps | Proxy tốt nhất hiện có |
| `cost.turns` | Số turn / heartbeat dài / `ask` blocking | Mailbox + heartbeat | Proxy “độ rối” Task |
| `cost.rework_dispatches` | Số Dispatch/retry cùng Task (fail → replace) | Orca task/dispatch history | Phạt chất lượng + cost |

**Quy tắc proxy:** khi chưa có token → báo cáo **`cost.wall_ms` + `cost.rework_dispatches` + `cost.turns`**, gắn nhãn `meter=proxy`, không tuyên bố $/token.

### 3.2 Output quality (role-specific — chi tiết §5)

Chỉ số dùng chung (mọi role):

| Metric ID | Định nghĩa | Cách lấy gần đúng |
| --------- | ---------- | ----------------- |
| `qual.ac_met` | Acceptance của Task Spec đạt (checklist) | Comment / artifact path + verdict |
| `qual.scope_breach` | Sửa ngoài ownership / mở rộng MVP | Diff path vs Spec; binary 0/1 |
| `qual.reopen` | Sau `Chờ duyệt`/`Hoàn thành` quay `Đang làm` vì FAIL/gap | Project Status timeline (đã có trong đo nhẹ) |
| `qual.evidence_sha` | Có artifact exact-SHA khi role yêu cầu | `docs/reviews/*` hoặc comment |

### 3.3 Resource host

| Metric ID | Định nghĩa | Nguồn khả thi | Role nhạy |
| --------- | ---------- | ------------- | --------- |
| `host.rss_peak_mb` | Peak RSS process agent/tooling | OS / agent-top class tools | Coding, iOS sim |
| `host.cpu_pct_avg` | CPU trung bình cửa sổ Dispatch | Tương tự | BE test, iOS build |
| `host.sim_udid_hold` | Giữ Simulator/UDID ngoài Task | `simctl` / convention Task ports | `ios` |
| `host.db_port_collision` | Đụng DB/port worker khác | Log fail / convention | `backend` |
| `host.idle_retained` | Terminal reclaimable giữ vô ích | `worker-list` nextAction | coordinator |

**MVP:** không bắt buộc meter liên tục — chỉ **cờ sự cố** (collision, retained idle, sim ngoài scope) + ghi nhận khi Task nặng (iOS build).

### 3.4 Process / WIP (neo `github-project-tracking.mdc`)

Tái sử dụng đo nhẹ hiện có; gắn **Role của Task** (không gắn người):

| Metric ID | Định nghĩa | Ngưỡng / hành động gợi ý (đã có rule) |
| --------- | ---------- | ------------------------------------- |
| `proc.wait_review_h` | Giờ từ `Chờ duyệt` → DoD comment có SHA+verdict | Hàng đợi đầy → ưu tiên reviewer |
| `proc.ci_rerun` | Số re-run/push CI cùng PR trước xanh | >2 không rõ nguyên nhân → dừng feature slice |
| `proc.acceptance_reopen` | Reopen sau FAIL/gap | Bắt buộc revalidation SHA mới |
| `proc.queue_depth_review` | Số item `Chờ duyệt` (board) | ≥3 = tín hiệu đầy |
| `proc.open_pr_slice` | PR mở cùng ownership slice chờ DoD/CI | ≥2 = đầy slice |
| `proc.blocked_true` | `Bị chặn` có dependency thật còn mở | Phân biệt chờ giả vs hard dep |
| `proc.parallel_waste` | Feature mới spawn khi queue đầy (vi phạm backpressure) | Audit coordinator wave |

---

## 4. Dimensions so sánh công bằng giữa role

Không xếp hạng “role thắng” bằng một số. So sánh chỉ trong **cùng stratum**:

| Stratum | Roles | Đơn vị so sánh hợp lệ |
| ------- | ----- | --------------------- |
| **Discovery / design** | `product-ba`, `product-design`, `architect` (mode thiết kế) | Thời gian unblock consumer; thiếu artifact; scope breach; số hỏi lại AC |
| **Implementation** | `backend`, `web`, `ios` | `qual.reopen` + CI + ownership breach; cost/wall theo **độ lớn Task** (S/M/L) |
| **Assurance** | `reviewer-dod`, `reviewer-security`, `architect` (mode kiểm tra SHA) | Độ chính xác verdict (false PASS/FAIL); thời gian `proc.wait_review_h`; independence violation = fail cứng |
| **Orchestration** | Epic planner, coordinator gốc | Throughput Task Hoàn thành / wall; idle slot; queue depth; không đếm “số spawn” là tốt |

**Chuẩn hóa bắt buộc trước khi so sánh cost:**

1. Gắn **Task size band** (S ≤1 file docs / M 1 PR slice / L multi-module) — ước lượng tay MVP.  
2. Chỉ so sánh cùng band + cùng stratum.  
3. Ghi **Architecture impact Có/Không** — Task Có thường đắt hơn; không phạt role.  
4. Attribution: ưu tiên **Role ID trong Task Spec**; nếu thiếu → bucket `role=unspecified` (không gộp vào trung bình role).

---

## 5. Bảng metric theo role

Chú thích cột **MVP:** `P0` = đo bằng proxy/manual trong đợt gần; `P1` = cần telemetry; `—` = không áp dụng chính.

### 5.1 `product-ba`

| Metric | Định nghĩa ngắn | MVP | Evidence |
| ------ | --------------- | --- | -------- |
| `ba.ac_verifiable` | AC có checklist/Given-When-Then hoặc lệnh kiểm chứng | P0 | Artifact docs / Issue |
| `ba.non_goals_listed` | Có non-goals / out-of-scope | P0 | Cùng artifact |
| `ba.consumer_unblock_h` | Giờ từ BA `worker_done` → consumer coding `Đang làm` (nếu dep thật) | P0 | Project + Orca timestamps |
| `ba.ac_churn` | Số lần sửa AC sau khi coding đã start vì thiếu sót BA | P0 | Comment / reopen reason |
| `ba.scope_creep_flag` | Đề xuất ngoài MVP không ghi defer/reject | P0 | Review thủ công |
| Cost/host | `cost.wall_ms`, `cost.turns` | P0 | Orca |
| Process | Ít tạo false dependency serial | P0 | DAG Task deps |

**Hiệu quả cao:** AC đủ để coding không hỏi lại; non-goals rõ; không tự mở rộng MVP.

### 5.2 `product-design`

| Metric | Định nghĩa ngắn | MVP | Evidence |
| ------ | --------------- | --- | -------- |
| `pd.handoff_5pack` | Đủ 5 mục DoD role (flow, states, a11y, AC UI, impl notes) | P0 | Handoff path |
| `pd.ui_block_false` | Chặn web/iOS khi Task không thật sự cần PD | P0 | Dep audit |
| `pd.impl_drift` | Impl lệch handoff → finding DoD gắn “design gap” | P0 | Review artifact |
| Cost/host | wall/turns | P0 | Orca |

### 5.3 `architect`

| Metric | Định nghĩa ngắn | MVP | Evidence |
| ------ | --------------- | --- | -------- |
| `arch.options_compared` | ≥2 phương án (kể cả giữ hiện trạng) khi quyết định mới | P0 | ADR/handoff |
| `arch.consumer_deps_minimal` | Chỉ chặn consumer thiếu artifact thật | P0 | Task `--deps` |
| `arch.drift_caught` | (Mode review) phát hiện drift trên exact SHA trước prod risk | P0 | `docs/reviews/*-architecture.md` |
| `arch.over_gate` | Ép mọi PR qua Architect không đúng trigger | P0 | Audit spawn |
| Cost | wall; token P1 | P0/P1 | — |

### 5.4 `backend`

| Metric | Định nghĩa ngắn | MVP | Evidence |
| ------ | --------------- | --- | -------- |
| `be.ownership_ok` | Diff chỉ `apps/api|worker`, `packages/backend` (+ migration scope) | P0 | `git diff --stat` |
| `be.ci_green_sha` | CI (+ database-isolation khi relevant) xanh trên SHA tích hợp | P0 | GH Checks |
| `be.qual.reopen` | Reopen DoD/security trên slice BE | P0 | Project |
| `be.host.db_isolation` | Không đụng DB/port worker khác | P0 | Fail log / convention |
| `be.contract_coord` | Đổi OpenAPI qua coordinator, không sửa generated tay | P0 | Diff review |
| Cost | wall; token P1; test wall riêng nếu có | P0/P1 | — |

### 5.5 `web`

| Metric | Định nghĩa ngắn | MVP | Evidence |
| ------ | --------------- | --- | -------- |
| `web.ownership_ok` | Chỉ `apps/web` | P0 | Diff |
| `web.uat_headless` | Khi AC yêu cầu: evidence Playwright/scripts headless | P0 | `.uat-artifacts` / review |
| `web.qual.reopen` / CI | Như BE | P0 | Project / GH |
| Cost/host | wall; tránh headed browser trừ user xin | P0 | — |

### 5.6 `ios`

| Metric | Định nghĩa ngắn | MVP | Evidence |
| ------ | --------------- | --- | -------- |
| `ios.ownership_ok` | Chỉ `apps/mobile` | P0 | Diff |
| `ios.no_eas_cloud` | Không dùng EAS Cloud Build | P0 | Log/commands |
| `ios.local_build_evidence` | Khi milestone/AC yêu cầu: prebuild + xcodebuild/fastlane local | P0 | Review / comment |
| `ios.host.sim_isolation` | UDID/port Task-specific; không cướp sim worker khác | P0 | Convention / fail |
| `ios.team_personal` | Signing team `BLUA62D52G` khi build side-project | P0 | Build settings check |
| Cost/host | wall **cao hơn** coding docs — so sánh trong band L | P0 | — |

### 5.7 `reviewer-dod`

| Metric | Định nghĩa ngắn | MVP | Evidence |
| ------ | --------------- | --- | -------- |
| `dod.independence` | Session ≠ implementer | P0 | Dispatch IDs |
| `dod.exact_sha` | Artifact ghi SHA đang duyệt | P0 | `docs/reviews/*` |
| `dod.verdict_valid` | PASS/FAIL/PASS-with-gap đúng rule (không nuốt gate) | P0 | Artifact + routing |
| `dod.false_pass` | PASS rồi reopen/security fail cùng SHA logic | P0 | Timeline |
| `dod.latency_h` | Đóng góp giảm `proc.wait_review_h` | P0 | Project |
| Cost | wall/turns — **không** tối ưu bằng bỏ checklist | P0 | — |

### 5.8 `reviewer-security`

| Metric | Định nghĩa ngắn | MVP | Evidence |
| ------ | --------------- | --- | -------- |
| `sec.independence` | ≠ implementer (và nên ≠ DoD session nếu cả hai) | P0 | Dispatch IDs |
| `sec.scope_sensitive` | Chỉ spawn khi slice nhạy cảm (authz/RLS/quota/…) | P0 | Spec trigger |
| `sec.findings_actionable` | Finding có path/invariant Vemoki, không OWASP dump | P0 | Artifact |
| `sec.gate_not_replaced` | Không bị thay bằng chỉ DoD UI | P0 | Board audit |
| `sec.false_clear` | Clear rồi incident/tenant bug cùng class | P1 | Post-hoc |

### 5.9 Epic planner (không Role ID catalog — vẫn đo)

| Metric | Định nghĩa ngắn | MVP | Evidence |
| ------ | --------------- | --- | -------- |
| `plan.ready_queue_fresh` | Đề xuất wave gồm mọi Task unblocked (không serial Story giả) | P0 | Wave notes / Task deps |
| `plan.deps_precision` | `% deps` là artifact thật (false dep thấp) | P0 | Audit `--deps` |
| `plan.no_child_spawn` | Không `worker-start` từ planner | P0 | Orca tree |
| `plan.arch_flag_coverage` | Mọi Task Spec có Architecture impact Có\|Không | P0 | Spec samples |
| Cost | wall planner session | P0 | Orca |

### 5.10 Coordinator gốc

| Metric | Định nghĩa ngắn | MVP | Evidence |
| ------ | --------------- | --- | -------- |
| `coord.mailbox_sla` | `question`/`worker_done` được reply/ack/settle không chờ user nudge | P0 | Mailbox timestamps |
| `coord.idle_fill` | Slot free được fill cùng checkpoint khi còn ready | P0 | Wave logs |
| `coord.wip_backpressure` | Không phình feature khi queue đầy (tín hiệu § WIP) | P0 | `proc.*` |
| `coord.cleanup` | Release reclaimable; không giữ idle vô hạn | P0 | `worker-list` |
| `coord.dod_dispatch` | Mỗi `Chờ duyệt` độc lập có reviewer ≠ implementer | P0 | Dispatch map |
| Cost/host | Ít đo token; đo **process health** là chính | P0 | — |

---

## 6. Non-goals (spike + MVP đo)

| Non-goal | Lý do |
| -------- | ----- |
| Production dashboard / SaaS billing gắn Vemoki | Ngoài scope spike; privacy + ops chưa chốt |
| Leaderboard “role nào giỏi nhất” theo token | So sánh không công bằng giữa stratum |
| Implement meter trong `apps/**` | Ownership spike docs-only; BE/web làm ở file 06/07 |
| Thu thập nội dung prompt/full transcript làm metric mặc định | Rủi ro privacy / bí mật Task |
| Đồng nhất KPI với agency-agents upstream | Catalog Vemoki đã cắt; metric theo DoD Vemoki |
| Thay DoD Project bằng score hiệu quả | Score hỗ trợ điều phối, không đóng Issue |
| Đo cảm xúc user / NPS agent | Không có kênh thu thập trong MVP |
| Bắt buộc OpenTelemetry GenAI ngay trên mọi worker | Cần ADR (file architect); MVP dùng proxy |

---

## 7. In / out of scope nghiên cứu này

**In**

- Định nghĩa hiệu quả + 4 lớp metric + bảng theo role (§2–§5).
- MVP slice đo được bằng Orca + Project #3 + review artifact (§8).
- Câu hỏi mở cho user / synthesis (§10).
- Gợi ý công bằng và band kích thước Task (§4).

**Out**

- Schema DB, API ingest, UI monitor (→ 03/06/07).
- UX dashboard (→ 02).
- SOTA survey chi tiết (→ 04).
- Evidence gate reviewer chi tiết hóa checklist (→ 05; taxonomy chỉ nêu ID metric).

---

## 8. MVP slice vs later

### 8.1 MVP (đủ để chạy 1–2 đợt thủ công / bán tự động)

**Thu thập tối thiểu mỗi Dispatch settled:**

1. `taskId`, `dispatchId`, **Role ID** (từ Spec; hoặc `unspecified`).  
2. `cost.wall_ms`, `cost.rework_dispatches`, số `ask`.  
3. Project Status transitions liên quan (đặc biệt `Chờ duyệt` → verdict).  
4. `qual.scope_breach` (0/1) + `qual.reopen` (0/1).  
5. Với reviewer: `dod.independence` / `sec.independence` + có/không `qual.evidence_sha`.  
6. Một dòng coordinator khi áp lực WIP: `proc.queue_depth_review`, `proc.open_pr_slice`.

**Cách làm MVP:** spreadsheet hoặc markdown bảng đợt — **không** cần service mới. Nguồn: `ORCA orchestration worker-list --json`, Project #3, `docs/reviews/*`.

**Không có trong MVP:** token/$, RSS liên tục, agent-top production, cross-role leaderboard tự động.

### 8.2 Later (sau ADR telemetry / privacy)

- `cost.tokens_*` / `cost.usd_est` per Role-attribution.  
- Host metrics sampling (opt-in).  
- False PASS/FAIL rates có thống kê.  
- Tự động gắn metric vào Run summary Orca.  
- Surface web nội bộ (file 07) đọc data plane (file 06).

---

## 9. Acceptance criteria (kiểm chứng được)

### 9.1 AC cho artifact taxonomy này (Task hiện tại)

| # | Given / When / Then |
| - | ------------------- |
| AC1 | Given catalog Role trong `docs/agents/README.md`, when đọc file này, then mỗi Role ID (+ planner/coordinator) có ≥1 metric quality riêng trong §5. |
| AC2 | Given Orca chưa có token per role, when áp dụng MVP, then vẫn đo được bằng `cost.wall_ms` + process metrics §3.4 mà không claim `$/token`. |
| AC3 | Given nhu cầu so sánh BE vs BA, when dùng §4, then phải cùng stratum + size band — document nêu rõ cấm leaderboard token đa stratum. |
| AC4 | Given non-goals §6, when đề xuất dashboard SaaS hoặc sửa `apps/**`, then bị loại khỏi scope taxonomy này. |
| AC5 | Given đo nhẹ Project (chờ duyệt, CI re-run, acceptance reopen), when map sang taxonomy, then dùng đúng ID `proc.wait_review_h` / `proc.ci_rerun` / `proc.acceptance_reopen`. |

### 9.2 AC cho “MVP monitor” (đợt sau — để synthesis theo dõi)

| # | Tiêu chí |
| - | -------- |
| M1 | ≥10 Dispatch liên tiếp ghi đủ 6 trường MVP §8.1. |
| M2 | Mọi Dispatch reviewer trong mẫu có kiểm tra independence. |
| M3 | Báo cáo đợt có 1 dòng WIP (`proc.queue_depth_review` + việc ưu tiên review/fix/feature). |
| M4 | Không lưu raw prompt đầy đủ trong kho metric mặc định (privacy). |

---

## 10. Câu hỏi mở cho user / coordinator

1. **Ngân sách lộ diện:** có chấp nhận ước lượng $/token nội bộ (local log) hay chỉ wall-clock + qualitative?  
2. **Retention:** giữ metric bao lâu (7 ngày / 90 ngày / theo Epic)?  
3. **Attribution multi-role:** một Dispatch gắn hai Role (DoD + security) — tách 50/50 cost hay hai bản ghi độc lập?  
4. **Planner scoring:** có muốn điểm “false dependency” công khai trên board hay chỉ báo cáo coordinator?  
5. **iOS cost band:** có tách riêng “docs-only mobile” vs “native build” thành hai band bắt buộc không?  
6. **Privacy floor:** cấm tuyệt đối transcript, hay cho phép hash/length-only?  
7. **Mục tiêu tối ưu chính 90 ngày tới:** giảm `proc.wait_review_h`, giảm `qual.reopen`, hay giảm wall-clock coding?

---

## 11. Dependencies / handoff

| Consumer spike | Cần từ taxonomy |
| -------------- | --------------- |
| `02-pd-monitor-ux` | Nhóm metric hiển thị theo stratum; tránh leaderboard token |
| `03-architect-telemetry` | ID metric + privacy non-goals; quyết định P0 proxy vs OTel |
| `04-sota-landscape` | Map SOTA tools → metric ID §3 |
| `05-dod-evidence-gates` | `dod.*` / `sec.*` / `qual.evidence_sha` |
| `06-backend-data-plane` | Schema gợi ý từ MVP fields §8.1 |
| `07-web-surfaces` | MVP = bảng đợt; later = UI theo stratum |
| `00-synthesis` | Chốt câu trả lời §10 + cắt MVP |

**Dependencies cứng:** không chặn coding sản phẩm; chỉ chặn implement monitor khi chưa có ADR privacy/attribution (architect).

---

## 12. Success evidence (cho Task BA này)

- [x] File `docs/spikes/agent-role-monitor/01-ba-metrics-taxonomy.md` tồn tại.  
- [x] Có định nghĩa hiệu quả, 4 lớp metric, bảng theo role, non-goals, MVP vs later, AC kiểm chứng, câu hỏi mở.  
- [x] Map được sang đo nhẹ Project #3 hiện có.  
- [ ] (Ngoài Task) Chạy thử thu thập MVP trên một đợt thật — thuộc coordinator / synthesis.

---

## 13. Rủi ro nhanh

| Rủi ro | Mitigation |
| ------ | ---------- |
| Tối ưu token làm hỏng DoD | Assurance stratum cấm tối ưu cost bằng bỏ checklist |
| Gán nhầm role → thống kê sai | Bucket `unspecified`; Spec bắt buộc Role ID (đã có rule) |
| Parallel-first bị hiểu là “host waste” | `host.idle_retained` ≠ parallel hợp lệ; chỉ phạt retain vô ích |
| Privacy prompt leak | Non-goal + M4; architect chốt retention |
