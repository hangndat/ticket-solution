# 05 — DoD evidence gates (chống vanity metrics)

**Spike:** [Agent Role Effectiveness Monitor](./README.md)  
**Role:** `reviewer-dod` · [docs/agents/roles/reviewer-dod.md](../../agents/roles/reviewer-dod.md)  
**Architecture impact:** Không (định nghĩa nghiệm thu research / MVP sau này)  
**Neo process:** `.cursor/rules/github-project-tracking.mdc` § Evidence exact-SHA + § Đo lường nhẹ

## 1. Mục tiêu

Định nghĩa **cách chứng minh** claim dạng «role X hiệu quả hơn role Y» (cost/token, chất lượng output, tài nguyên host) **không bị vanity metrics** — fantasy score, tự chấm, dashboard đẹp thiếu ledger, hoặc `worker_done` = thành công.

Hai tầng nghiệm thu:

| Tầng | Đối tượng | Khi nào |
| ---- | --------- | ------- |
| **A — Spike docs** | Artifact markdown `01`–`07` + `00-synthesis` | Wave research hiện tại |
| **B — MVP tooling** | Telemetry / ledger / surface đo role (BE + web sau này) | Khi implement theo synthesis |

Verdict thống nhất: `PASS` | `FAIL` | `PASS with known gap` (gap có chủ đích, không nuốt gate bắt buộc — khớp `orca-agent-routing.mdc`).

## 2. Claim hợp lệ vs vanity

### 2.1 Claim được phép tuyên bố

Một claim so sánh role **chỉ được PASS** khi đồng thời:

1. **Đơn vị so sánh rõ:** Role ID catalog (`backend` / `web` / `ios` / `product-ba` / `product-design` / `architect` / `reviewer-dod` / `reviewer-security`) — không gộp «Cursor vs Codex» trừ khi Task ghi rõ override agent.
2. **Cùng loại việc:** cùng ownership slice hoặc cùng class Task (vd. DoD review exact-SHA), không so `product-ba` discovery với `ios` coding.
3. **Cùng cửa sổ thời gian / đợt** (Epic / Run / Project đợt D*) và ghi rõ sample size.
4. **Outcome gắn evidence bên ngoài agent:** Project Status events, review artifact exact-SHA, CI, hoặc ledger immutable — không chỉ prose trong chat worker.
5. **Mẫu số và mẫu số loại trừ** được ghi (vd. loại Task `Bị chặn` ngoại vi, loại cancel trước khi code).

### 2.2 Vanity metrics (FAIL nếu dùng làm bằng chứng chính)

| Vanity | Vì sao không đủ |
| ------ | ---------------- |
| Điểm tự chấm 0–100 / «confidence 98%» của chính role đang đo | Không độc lập; reviewer-dod cấm fantasy score |
| Số token / chi phí **ước lượng** không có nguồn meter | Không tái lập được |
| `worker_done --outcome succeeded` không kèm Project/`docs/reviews` | Orca settle ≠ Project `Hoàn thành` |
| GitHub Approve UI không kèm exact-SHA + reviewer độc lập | Không đủ DoD theo Project rules |
| «PASS kế thừa» từ SHA cũ sau commit hành vi mới | Thiếu revalidation |
| Chỉ số throughput (Task/ngày) không tách reopen / CI re-run / `Bị chặn` | Che chất lượng |
| So sánh role khi attribution Task→Role ID thiếu hoặc đoán từ folder | Sai attribution |
| Dashboard screenshot không trỏ row ledger / query tái chạy | Không audit được |

## 3. Checklist evidence (bắt buộc)

### 3.1 Ledger fields (mỗi quan sát / Task được đo)

Mỗi row dùng để so sánh role **phải** có đủ (MVP: persist; spike: bảng markdown hoặc CSV đính kèm synthesis cũng được nếu đủ field):

| Field | Bắt buộc | Ghi chú |
| ----- | -------- | ------- |
| `observation_id` | Có | UUID hoặc slug ổn định |
| `role_id` | Có | Catalog ID; không tự invent |
| `agent` | Có | Thường `cursor`; ghi override nếu có |
| `task_id` / `dispatch_id` | Có khi có Orca | Phân biệt retry / straggler |
| `issue_number` | Có khi có Project | Link Project #3 |
| `pr_number` | Khi có PR | |
| `ownership_slice` | Có | `backend` / `web` / `ios` / `coordinator` / docs |
| `run_id` / `epic_ref` | Prefer | Cửa sổ so sánh |
| `status_timeline` | Có | Xem §3.2 |
| `impl_sha` | Khi có code | Exact SHA tip branch lúc `Chờ duyệt` |
| `integrated_sha` | Khi đã merge | Exact SHA trên `main` (CI xanh) |
| `review_sha` | Khi có DoD | Exact SHA verdict; ≠ tên branch |
| `reviewer_session` | Khi có DoD | **≠** implementer session |
| `verdict` | Khi đóng vòng | `PASS` / `FAIL` / `PASS with known gap` |
| `checks` | Khi có code | Lệnh + kết quả trên `review_sha` hoặc ghi `docs-only` |
| `artifact_path` | Prefer | `docs/reviews/<slug>.md` hoặc URL comment |
| `cost_tokens_in` / `cost_tokens_out` / `cost_usd` | Khi claim cost | Nguồn meter bắt buộc (provider/OTel); `unknown` ≠ 0 |
| `host_cpu_seconds` / `host_peak_rss_mb` | Khi claim resource | Nguồn meter; không bịa |
| `ci_rerun_count` | Prefer | Khớp đo nhẹ Project |
| `acceptance_reopen` | Prefer | Boolean / count Status lùi sau FAIL |
| `known_gaps` | Khi verdict gap | ID gap + lý do chấp nhận |
| `excluded` + `exclude_reason` | Khi loại khỏi sample | Anti-cherry-pick |

**Thiếu field bắt buộc của loại claim** → không được dùng row đó trong so sánh (FAIL claim hoặc loại khỏi mẫu có ghi chú).

### 3.2 Project Status events (authority động)

Neo: Project #3 Status là authority; `worker_done` không chứng minh `Hoàn thành`.

Timeline tối thiểu cho Task có code (timestamps ISO hoặc gần đúng từ comment/`gh`):

| Event | Status đích | Evidence kèm |
| ----- | ----------- | ------------ |
| Dispatch / bắt đầu | `Đang làm` | dispatch_id / worktree comment |
| Blocker thật | `Bị chặn` | comment lý do |
| Impl xong chờ review | `Chờ duyệt` | comment + artifact + **exact SHA** |
| DoD pass + merge + CI (khi cần) | `Hoàn thành` | review verdict + integrated SHA |

Chỉ số process (đã có trong Project rules — **không vanity** nếu lấy từ timeline thật):

| Chỉ số | Cách chứng minh |
| ------ | ---------------- |
| Thời gian chờ duyệt | `t(Chờ duyệt)` → `t(comment DoD có SHA + verdict)` |
| CI re-run | Số re-run / push sửa CI trên cùng PR trước xanh |
| Acceptance reopen | `Hoàn thành` hoặc `Chờ duyệt` → lại `Đang làm` sau FAIL / gap mới; ghi SHA fail + SHA fix |

Claim «role X nhanh hơn» **phải** tách: wall-clock coding vs queue chờ duyệt vs CI — không gộp một số «cycle time» mơ hồ.

### 3.3 Exact SHA (khi có code)

Khớp bảng Evidence bắt buộc trong `github-project-tracking.mdc`:

| Trường | Yêu cầu |
| ------ | ------- |
| Reviewer / session | Độc lập implementer; ghi cách spawn |
| Scope | Issue / PR / paths / Role ID |
| Commit SHA | Exact (`git rev-parse`); không «HEAD lúc nào đó» |
| Checks | Trên đúng SHA hoặc `docs-only` |
| Findings / limitations | Có |
| Revalidation | Commit hành vi mới → review lại; không kế thừa PASS |
| Artifact path | `docs/reviews/*` hoặc comment tương đương |

Docs-only spike Task: SHA **không bắt buộc** cho nội dung markdown thuần; nếu claim dựa trên tooling đã merge thì SHA tooling **bắt buộc**.

## 4. Anti-cheat (tự chấm điểm & gaming)

| # | Quy tắc | PASS khi | FAIL khi |
| - | ------- | -------- | -------- |
| AC-1 | Độc lập reviewer | Verdict chất lượng / DoD do session **khác** implementer (và khác role đang được «tự khen» nếu claim về reviewer) | Role tự ghi «effectiveness score» làm primary evidence |
| AC-2 | Cấm fantasy score | Không dùng thang điểm nội bộ agent thay ledger | «98/100 quality» không map artifact |
| AC-3 | Meter trước claim | Cost/token/RAM chỉ từ nguồn có thể audit (export provider, OTel, host agent); thiếu → `unknown`, không so sánh | Điền 0 hoặc ước lượng miệng |
| AC-4 | Attribution cứng | `role_id` lấy từ Task Spec / dispatch evidence lúc spawn, không backfill sau khi biết outcome | Gán role sau kết quả để «thắng» |
| AC-5 | No cherry-pick | Pre-register cửa sổ mẫu + exclusion rules; mọi Task trong cửa sổ vào mẫu hoặc `excluded` có lý do | Chỉ báo Task xanh |
| AC-6 | No double-count | Một `dispatch_id` một lần trong mẫu; retry ghi `supersedes` | Cộng dồn retry như success riêng |
| AC-7 | Outcome ≠ settle | So sánh hiệu quả dùng Project + review SHA, không dùng mailbox settle làm proxy chất lượng | Bảng xếp hạng theo `worker_done` count |
| AC-8 | Revalidation | PASS gắn SHA; SHA đổi hành vi → invalidate | Tái dùng verdict cũ |
| AC-9 | Gap có chủ đích | `PASS with known gap` liệt kê gap ID + ai chấp nhận (coordinator) | Gap ẩn / nuốt acceptance bắt buộc |
| AC-10 | Cross-role fairness | Không so metric chỉ có một role đo được (vd. chỉ BE có CPU) trừ khi normalize hoặc đánh dấu incomparable | Crowning winner trên metric thiếu ở role khác |

**Self-score cho phép (phụ):** agent được ghi `self_notes` / confidence **chỉ** là annotation; **không** được đưa vào công thức xếp hạng hay gate PASS.

## 5. PASS / FAIL — Tầng A (spike docs)

Áp dụng cho nghiệm thu artifact research (file `05` này và peer docs khi coordinator tổng hợp). Reviewer độc lập (khác author file) khi đóng spike.

| # | Gate | PASS | FAIL |
| - | ---- | ---- | ---- |
| S-1 | Ownership | File đúng owner; không sửa ngoài scope giao | Đụng `01`–`04`, `06`–`07` hoặc apps production ngoài ủy quyền |
| S-2 | Claim hygiene | Mọi khuyến nghị so sánh role trích §2–§4 hoặc đánh dấu hypothesis | Tuyên bố «role X tốt hơn» không điều kiện evidence |
| S-3 | Evidence map | Có bảng field ledger + Status events + anti-cheat | Chỉ mô tả UX dashboard / SOTA link |
| S-4 | Vanity denylist | Liệt kê vanity bị cấm (hoặc trỏ §2.2) | Đề xuất scorecard tự chấm làm KPI chính |
| S-5 | MVP handoff | Có PASS/FAIL tầng B đủ để BE/web implement không đoán | «Làm dashboard rồi tính» |
| S-6 | Known gaps | Gap spike được liệt kê (§7) | Giả vờ đã có meter token/CPU từ Orca hôm nay |
| S-7 | Language | User-facing tiếng Việt; giữ URL/IDs/commands | |

**DoD đóng spike (tầng A):** S-1…S-7 PASS (hoặc `PASS with known gap` chỉ trong §7). Không yêu cầu merge/`Hoàn thành` Project trừ khi có Task code riêng.

## 6. PASS / FAIL — Tầng B (MVP tooling sau này)

Khi có implementation (neo `06-backend-data-plane`, `07-web-surfaces`, synthesis):

| # | Gate | PASS | FAIL |
| - | ---- | ---- | ---- |
| M-1 | Ledger schema | Persist đủ field §3.1 cho observation có code | Schema thiếu `role_id` / SHA / reviewer independence |
| M-2 | Status ingest | Timeline Status (hoặc equivalent event log) khớp Project authority | Chỉ poll `worker_done` |
| M-3 | Exact-SHA link | UI/API so sánh chất lượng deep-link được `review_sha` + artifact | Chart không drill về SHA |
| M-4 | Independence flag | Hệ đánh dấu / reject self-review làm DoD evidence | Cho phép implementer session = reviewer |
| M-5 | Cost/resource | Claim cost/RAM chỉ hiện khi meter status = `metered`; `unknown` không xếp hạng | Coi missing = 0 |
| M-6 | Anti-cheat tests | Có test/fixture chứng minh AC-1…AC-10 (hoặc subset ghi rõ) không regress | Không có kiểm thử gaming |
| M-7 | Sample integrity | Export mẫu có exclusion log + cửa sổ pre-register | Ad-hoc filter trên UI không audit |
| M-8 | DoD artifact | Thay đổi tooling: `docs/reviews/*` + exact SHA + reviewer ≠ implementer trước `Hoàn thành` | Merge chỉ vì demo đẹp |
| M-9 | Privacy | Không log prompt/secret user; token aggregate theo policy architect spike | Raw prompt trong ledger public |
| M-10 | Incomparable | UI phân biệt «không đủ dữ liệu» vs «thua» | Crowning role thiếu meter |

**Claim công bố «role X hiệu quả hơn» (ngoài nội bộ experiment):** cần M-1…M-7 + M-10 PASS trên exact SHA tooling; M-8 cho chính PR đo; M-9 theo ADR/privacy.

## 7. Known gaps chấp nhận được (spike / early MVP)

Các gap sau **được** `PASS with known gap` nếu ghi rõ trong artifact/synthesis và **không** dùng để crowning production:

| Gap ID | Mô tả | Điều kiện chấp nhận | Không được |
| ------ | ----- | ------------------- | ---------- |
| G-ORCA-METER | Orca `worker-list` chưa có token/CPU per role | Claim cost/resource đánh `unknown` / out-of-scope | Bịa số hoặc suy từ wall-clock |
| G-MANUAL-LEDGER | Spike dùng bảng markdown/CSV thủ công | Cửa sổ mẫu nhỏ, exclusion ghi tay, không public ranking | Coi CSV tay = production SoTA |
| G-STATUS-TS | Timestamp Status lấy gần đúng từ comment/`gh` | Sai số ghi trong limitations | Precision fake đến giây không nguồn |
| G-DOCS-ONLY | Wave docs không có `impl_sha` | Tầng A only; không claim chất lượng code role | Dùng docs spike chứng minh coding effectiveness |
| G-SAMPLE-SIZE | n nhỏ (< ngưỡng pre-register, gợi ý n&lt;10) | Chỉ exploratory; cấm «statistically significant» | Công bố winner |
| G-CROSS-AGENT | Chưa tách Cursor vs override khác | Ghi mọi row `agent=cursor` hoặc tách cohort | Gộp agent khác nhau rồi crowning role |
| G-HOST-NOISE | CPU/RSS nhiễu đa process cùng máy | Chỉ so sánh tương đối cùng host profile; hoặc hoãn metric | Tuyệt đối hóa «role A tốn RAM hơn» cross-machine |

Gap **không** chấp nhận (luôn FAIL): thiếu independence reviewer khi claim DoD quality; thiếu exact SHA khi claim dựa trên code đã ship; vanity self-score làm KPI; nuốt acceptance/security bắt buộc của Task sản phẩm.

## 8. Quy trình nghiệm thu ngắn

```text
1. Xác định tầng A (docs) hay B (tooling).
2. Liệt kê claim cần chứng minh → map sang field §3 + anti-cheat §4.
3. Thu thập ledger rows / Status timeline / artifacts SHA.
4. Chạy checklist S-* hoặc M-*.
5. Verdict + gap IDs → docs/reviews/<slug>.md (khi có code) hoặc comment đóng spike.
6. Commit hành vi mới sau PASS → revalidation SHA mới (không kế thừa).
```

## 9. Không làm (nhắc lại)

- Dùng fantasy score / self-score làm bằng chứng hiệu quả role.
- Coi Orca settle hoặc GitHub Approve UI thay exact-SHA DoD độc lập.
- So sánh role lệch class Task hoặc lệch attribution.
- Crowning winner khi meter = `unknown` hoặc sample cherry-pick.
- Sửa file spike ngoài `05-dod-evidence-gates.md` trong Task ownership này.

## 10. Handoff

- BA taxonomy (`01`): metric phải map được sang field §3.1 hoặc vào denylist vanity.
- Architect telemetry (`03`): privacy + attribution phải thỏa M-5/M-9 và AC-3/AC-4.
- Backend (`06`) / web (`07`): implement schema + surfaces theo gate tầng B.
- Coordinator `00-synthesis`: chỉ được khuyến nghị MVP đo role nếu S-* PASS và gap §7 được chấp nhận có chủ đích.
