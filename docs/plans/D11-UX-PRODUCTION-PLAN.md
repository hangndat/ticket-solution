# D11 — Nghiên cứu & thiết kế UX/UI cho vận hành production

> **Đã duyệt triển khai ngày 18/10/2026:** user trả lời “duyệt” cho gói D11. Phạm vi thực thi: web admin theo công việc/readiness; iOS Gate feedback/offline/conflict; attendee web/iOS nhận vé/QR/recovery; brand-test đa tenant và a11y trong các bề mặt đó. Thứ tự wave: web admin ∥ iOS Gate, rồi attendee theo slot ownership. Cho phép workflow feature branch → PR → review độc lập → CI → coordinator integration theo git-workflow. Validate-only/manual lookup, metrics mới, O06 số liệu, publish privacy, production deploy và store submit **không** được tự mở từ phê duyệt này. Các phần “chưa approved” bên dưới là snapshot proposal trước phê duyệt; Task Spec cụ thể và comment approval trên #222 là authority thực thi.


**Trạng thái artifact:** DRAFT proposal **đã reconcile BA/PD lần 1** (pha discovery) — **chưa** là roadmap triển khai đã duyệt.
**Ngày soạn / reconcile:** 2026-10-18
**Baseline source `main`/HEAD:** `3e61cde42d55654897048d6d627ab6834b54b808` — **không** chứng minh SHA deployment production (xem [D11-DISCOVERY-BASELINE](../reviews/D11-DISCOVERY-BASELINE.md)).
**Quyết định:** [DECISION-LOG O11](../DECISION-LOG.md) — ủy quyền discovery/design; **không** tự chốt feature list.
**Board (authority):** [Project #3](https://github.com/users/hangndat/projects/3)

| Issue | Vai trò | Ownership path |
| --- | --- | --- |
| [#222](https://github.com/hangndat/ticket-solution/issues/222) | Epic D11 | Parent |
| [#223](https://github.com/hangndat/ticket-solution/issues/223) | Story discovery/design | Parent stories |
| [#224](https://github.com/hangndat/ticket-solution/issues/224) | BA research | `docs/plans/D11-BA-RESEARCH.md` |
| [#225](https://github.com/hangndat/ticket-solution/issues/225) | PD design + prototype | `docs/design/D11-PRODUCTION-UX-UI.md`, `docs/design/d11-prototype/**` |
| [#226](https://github.com/hangndat/ticket-solution/issues/226) | Epic planner (file này + `docs/tasks/d11/**`) | Planner docs only |

**Artifact liên kết (đã có trên disk — local, chưa commit):**

- BA: [`docs/plans/D11-BA-RESEARCH.md`](./D11-BA-RESEARCH.md) — #224; P0/P1 + §12 (4 quyết định khuyến nghị); DoD docs [`D11-BA-DOCS-REVIEW.md`](../reviews/D11-BA-DOCS-REVIEW.md) **PASS with known gap** (research-only)
- PD: [`docs/design/D11-PRODUCTION-UX-UI.md`](../design/D11-PRODUCTION-UX-UI.md) + prototype **đủ 6 files** (`index` + 3 flows gồm `staff-scan.html` + css + fixtures)
- Baseline: [`docs/reviews/D11-DISCOVERY-BASELINE.md`](../reviews/D11-DISCOVERY-BASELINE.md) — public `vemoki.com` 200; `/privacy` 404 tươi 18/10
- Task specs: [`docs/tasks/d11/`](../tasks/d11/) — pha B dùng ID `D11-B*` (không trùng Story #223)

**Không phải:** code complete · acceptance complete · pilot ready · store submit · deploy prod (trừ task riêng ủy quyền sau này).

---

## 0. Phân loại bằng chứng (bắt buộc)

| Loại | Nghĩa | Ví dụ trong D11 |
| --- | --- | --- |
| **Quan sát (observed)** | Có file/evidence/SHA/board tại thời điểm viết | Project #3: D0–D10 Hoàn thành (checkpoint 100/101; #7 hủy); `privacy` 404 ghi trong [D10-PR-170-DOD](../reviews/D10-PR-170-DOD.md); O06 vẫn mở trong DECISION-LOG |
| **Suy luận (inferred)** | Kết luận hợp lý từ quan sát + PRD/TD, chưa đo user | Sau D6/D9 polish, gap production chủ yếu nằm ở depth journey + ops + privacy surfaces hơn là “thiếu brand tokens” |
| **Giả thuyết (hypothesis)** | Cần BA/PD/validate; **không** coi là yêu cầu đã duyệt | Persona X pain Y; metric Z; feature đề xuất trong pha B |

**Giới hạn bằng chứng (Orca #222):** không phỏng vấn thật; không bịa baseline metrics/UAT; audit UI/source phải tách observed vs assumed. Graph `code-review-graph-ticket` tại lúc soạn: `head_matches_build=false` (built `3921f2e…`, head `3e61cde…`) — chỉ dùng để hẹp phạm vi; source/docs thắng.

---

## 1. Mục tiêu pha discovery (đã ủy quyền)

1. Làm rõ **pain / journey / ưu tiên** cho UX/UI hướng vận hành production trên baseline D0–D10 (BA).
2. Bàn giao **flow · state · a11y · UI AC · handoff** + prototype tương tác đánh dấu demo (PD).
3. Chia **Epic → Story → Task** với Role ID/path, dependency thật, wave fan-out, và **spec đủ để coordinator dispatch sau khi user review roadmap** (planner — file này).
4. Tách rõ: **research/design complete** ≠ coding; coding chỉ sau **user review** proposal.

### Non-goals (pha này và mọi đề xuất D11+)

| OUT | Lý do |
| --- | --- |
| Feature coding `apps/**` | Chưa duyệt roadmap triển khai |
| Commit / push / PR / merge từ worker discovery | Constraint task |
| Deploy prod / submit App Store | Cần ủy quyền riêng; O11 cấm tự làm |
| Hồi sinh Android / payment / refund / transfer / seat / Wallet | O10 hủy |
| Đổi invariant tenant / auth / quota / check-in / O05 | O11 |
| SaaS runtime / EAS Cloud Build | ADR-11 + chính sách iOS |
| Tuyên bố pilot/production ready từ UI/prototype | ROADMAP §1.1 |

---

## 2. Baseline sau D0–D10 (observed + suy luận)

### 2.1 Board / đợt (observed)

- **Quan sát:** ROADMAP live note 18/10 — D0–D10 **Hoàn thành** trên Project #3; #7 ngoài phạm vi hủy.
- **Quan sát:** snapshot bảng §1 ngày 17/10 trong ROADMAP là **lịch sử** (vd. D5 “Đang làm”) — không dùng làm status hiện tại.
- **Suy luận:** D6 brand polish + D7 offline Gate + D8 white-label + D9 seed/media/UX + D10 ASC prep đã có acceptance-level evidence riêng; D11 không làm lại D6 từ đầu.

### 2.2 UX đã có (observed từ reviews/plans — không re-audit toàn `apps/**` trong planner)

| Đợt | Evidence (ví dụ) | Proof limit |
| --- | --- | --- |
| D6 | Plan + PRs #92/#93/#94; brand tokens Vemoki | ≠ pilot |
| D7 | ADR-18 + reviews offline sync / web gate | Offline UX còn có thể sâu hơn theo BA/PD |
| D8 | White-label theming DoD | Branding cấu hình ≠ fork app |
| D9 | empty/error/loading polish web/iOS | Headless/sim; fail-closed OIDC chrome |
| D10 | ASC metadata; archive prep | `vemoki.com/privacy` **404** (known gap); chưa submit store |

### 2.3 Production readiness — không chỉ UI (observed gaps)

| Hạng mục | Trạng thái quan sát | Ảnh hưởng D11 |
| --- | --- | --- |
| **O06** retention / region / SLA | **Giữ mở** — [O06-OPTIONS.md](../ops/O06-OPTIONS.md) | Chặn ingest PII thật; BA §12 Q3; không ship retention số bịa |
| **Chỉ số thành công PRD §13** | BA §10: baseline **chưa đo** | Metric đề xuất + cách đo; không bịa số |
| **Capacity / SLO** | Baseline PRD + load drill D5; chưa claim 50k concurrent | Không gắn UX “đạt SLO” nếu thiếu benchmark hạ tầng đích |
| **Release checklist** | [RELEASE-CHECKLIST.md](../ops/RELEASE-CHECKLIST.md); D10 ASC prep ≠ submit | BA G-A…G-E §11 |
| **Runbook / rollback** | [RUNBOOK.md](../ops/RUNBOOK.md) có khung; freeze cửa sổ event | PD không thay; pilot path cần on-call review |
| **Device UAT** | APNs DELIVERED (D5 evidence); camera/venue chưa gộp D11 | Headless ≠ device; G-B BA §11 |
| **Privacy URL** | **404 tươi** 18/10 (`curl` + baseline doc) — quan sát public | S-P0-D; deploy chỉ khi ủy quyền + nội dung đã duyệt |
| **Home public** | `vemoki.com` 200; demo/jargon (baseline + BA) | S-P0-F; không suy SHA deploy = `3e61cde` |
| **Admin IA** | Source `admin-form.tsx` một trang; screenshot D8 **lịch sử** | S-P0-E; xác minh pixel `main` trước claim UAT |
| **Monitor / alert** | TD §16; không suy “đã đủ” từ board Hoàn thành | Gate pilot evidence độc lập |

**Kết luận (inferred):** “Đẩy mạnh UX/UI production” phải đi kèm đóng gap **policy (O06) · content pháp lý · measurement · ops UX · device proof** — không chỉ pixel.

---

## 3. Hai pha — ranh giới ủy quyền

```text
Pha A — Discovery / design          Pha B — Implementation (đề xuất)
[AUTHORIZED bởi O11 / user]         [CHỈ SAU user review roadmap]
  BA #224  ∥  PD #225  ∥  Planner #226
       ↓ reconcile
  Package review (plan + BA + PD)
       ↓ user duyệt / chỉnh
  Coordinator tạo Issues triển khai + worker-start
```

| Cổng | Điều kiện | Không được suy ra |
| --- | --- | --- |
| **Research/design complete** | BA + PD + plan reconcile; Gate ROADMAP D11 (1)–(3); artifact trên disk | Coding đã OK |
| **Code complete** | PR merge `main` + CI theo Task | Acceptance / pilot |
| **Acceptance complete** | DoD Project (review exact-SHA ≠ implementer, evidence) | Pilot ready |
| **Pilot ready** | TD §17 + device UAT + restore + runbook + O06 chốt + số liệu rõ | Store available |

---

## 4. Epic → Story → Task (pha A — đang chạy)

### Epic

**[#222] D11 — Nghiên cứu & thiết kế UX/UI production (Vemoki)**
Nhóm: Coordinator + Epic planner.
DoD Epic (discovery): đủ Gate ROADMAP D11 (1)–(4) với (4)=user review ghi nhận; không merge feature; không Hoàn thành Epic chỉ vì `worker_done`.

### Story discovery

**[#223]** Story khung discovery/design (parent BA/PD/Planner).

| Task | Issue | Role ID | Role path | Ownership | AC tóm tắt | Deps |
| --- | --- | --- | --- | --- | --- | --- |
| D11-A1 BA research | #224 | `product-ba` | `docs/agents/roles/product-ba.md` | `docs/plans/D11-BA-RESEARCH.md` | Pain có nguồn; journeys; IN/OUT; ưu tiên; AC/metrics đề xuất; không bịa phỏng vấn | — (∥ PD) |
| D11-A2 PD design | #225 | `product-design` | `docs/agents/roles/product-design.md` | `docs/design/D11-PRODUCTION-UX-UI.md` + `d11-prototype/**` | 5 deliverables PD DoD + prototype demo-labelled | Soft: đọc BA khi có; không hard-block nếu song song |
| D11-A3 Epic plan | #226 | *(planner — không gắn coding role)* | `.cursor/rules/orca-epic-orchestrator.mdc` | `docs/plans/D11-UX-PRODUCTION-PLAN.md` + `docs/tasks/d11/**` | Hierarchy + Role + wave + specs pha B + production gaps | Reconcile khi BA/PD có file |
| D11-A4 DoD discovery | *(sau Chờ duyệt)* | `reviewer-dod` | `docs/agents/roles/reviewer-dod.md` | `docs/reviews/D11-*-DOD.md` | Exact SHA docs; checklist Gate D11; ≠ implementer sessions | A1–A3 artifacts |

**Wave pha A (đã / đang):** `BA #224 ∥ PD #225 ∥ Planner #226` — tối đa fan-out; không spawn con từ planner.

---

## 5. Đề xuất pha B (CHƯA APPROVED) — map BA stories → Task

> Mọi mục dưới đây là **proposal** (ID Task = `D11-B*` — **không** dùng `D11-S1` cho pha B vì trùng Story discovery #223). User **review roadmap** + BA §12 khuyến nghị trước khi coordinator tạo Issue coding. **Không** `worker-start` coding cho đến khi user duyệt.

### 5.1 Map BA Stories → ownership (reconcile 2026-10-18)

Nguồn ưu tiên: BA §9 + §13; PD §5.4 handoff; evidence tươi baseline + source `admin-form.tsx` (~1930LOC, quan sát).

| BA Story | P | Ownership (1 slice / Dispatch) | Spec file | Deps thật |
| --- | --- | --- | --- | --- |
| S-P0-A Onboarding Owner / invite | P0 | `web` | `D11-B2-web-invite` (parent `D11-B2` = **TEMPLATE NOT DISPATCH-READY**) | Soft PD; known gap D4/D5 invite |
| S-P0-B Scanner offline queue clarity | P0 | `ios` (primary); web Gate chỉ nếu cùng đợt **sau** khi slot web rảnh | `D11-B4-ios-staff-scan` / `D11-B4-web-gate` (parent `D11-B4` = **TEMPLATE NOT DISPATCH-READY**) | ADR-18 có sẵn; PD Gate states; prototype `staff-scan.html` **đã có** (đủ 6 files trên disk) — **không** claim thiếu file hiện tại; lịch sử thiếu file chỉ ở §10 reconcile #1 |
| S-P0-C Brand-test multi-tenant | P0 | `web` **hoặc** `ios` (1 surface / Dispatch; không song song 2 feature cùng slice) | AC dùng chung [`D11-S-P0-C-brand-test-ac.md`](../tasks/d11/D11-S-P0-C-brand-test-ac.md); **gắn** vào Dispatch surface: `D11-B2-web-*` / `D11-B3` / `D11-B5` — **không** spawn parent multi-slice | D8 theming; PD §6.3 + tokens `brand/vemoki/tokens.json`; **không** đổi API/auth; xem AC đầy đủ bên dưới |
| S-P0-D Privacy & store prep gates | P0 | `web` (privacy page) + coordinator/ops ASC | `D11-B1` | **Public privacy:** nội dung **đã chốt/duyệt** trước publish; O06 chốt trước PII thật. Draft local ≠ production policy |
| S-P0-E Admin theo việc (IA) | P0 | `web` only | `D11-B5` (+ brand-test AC nếu surface admin trong scope) | PD admin readiness + progressive disclosure; source audit; screenshot D8 = **lịch sử** |
| S-P0-F Guest home production-lite | P0 | `web` | `D11-B2-web-home` | Evidence tươi home demo/jargon; PD first viewport; brand-test AC khi surface guest |
| S-P1-A Redeem stale / clarity | P1 | `web` (± `ios` redeem = Dispatch `ios` riêng) | `D11-B2-web-redeem` / `D11-B3` | FORM_VERSION_STALE evidence D4 |
| S-P1-B Admin readiness | P1 | `web` | sau/gộp `D11-B5` (cùng ownership web — vẫn 1 Dispatch) | Soft: sau P0-E |
| S-P1-C Validate-only / manual lookup | P1 optional | `ios` ± `backend` (Issue/Dispatch **tách**; contract **không** auto-approve) | `D11-B4-ios-staff-scan` (± `D11-B4-backend-validate-only` nếu user duyệt mở capability) | Optional sau kiểm tra capability (BA §12); **cấm** invent API; mọi contract change → escalate coordinator, chờ duyệt |
| Metrics instrumentation | P2 | `backend` (docs release = coordinator riêng) | `D11-B7-backend-metrics` / `D11-B7-coordinator-release-docs` (parent `D11-B7` = **TEMPLATE NOT DISPATCH-READY**) | Soft: BA §10 defs — **không** block P0; không serialize giả |
| a11y AA residual | P1/P2 | `web` **hoặc** `ios` (ready queue chọn 1/slice) | `D11-B6-web-a11y` / `D11-B6-ios-a11y` (parent `D11-B6` = **TEMPLATE NOT DISPATCH-READY**) | PD §3 |
| Milestone gate đợt | — | coordinator | `D11-B8` | Sau Stories được chọn merge |

#### S-P0-C — Brand-test AC (bắt buộc khi surface trong scope)

Checklist đầy đủ: [`docs/tasks/d11/D11-S-P0-C-brand-test-ac.md`](../tasks/d11/D11-S-P0-C-brand-test-ac.md). Tóm tắt nghiệm thu:

- [ ] **≥2 tenant/event** brand khác nhau trên **web và/hoặc iOS** theo surface Task (không claim cross-surface nếu Task chỉ 1 platform).
- [ ] **Nguồn brand rõ:** platform Vemoki vs tenant/org vs event — map surface → nguồn; tokens/fallback boundaries (`brand/vemoki/tokens.json` + ThemeProvider/slug) — event đã resolve brand **không** fallback wordmark Vemoki sai ngữ cảnh.
- [ ] **Sau switch tenant/event hoặc logout:** không lẫn brand/chrome của tenant trước (cache/session identity).
- [ ] **Screenshot crop** (bỏ chrome platform/nav chung) vẫn nhận đúng org/event brand — không chỉ đổi màu skin.
- [ ] **API / auth unchanged** — brand-test là UX/theming; không đổi contract/auth; gap field → escalate, không tự approve contract.
- [ ] **Headless commands:** `scripts/web-uat.sh` và/hoặc `scripts/sim-uat.sh` + artifact path; **proof limits:** headless ≠ device UAT; prototype HTML (PD headless QA 29/29 PASS — [`D11-PROTOTYPE-HEADLESS-QA.md`](../reviews/D11-PROTOTYPE-HEADLESS-QA.md)) **≠** runtime/app QA; screenshot D8 = lịch sử trừ khi chụp lại trên tip đang duyệt.

#### Parent templates multi-slice (không dispatch)

| Parent | Trạng thái | Dispatch chỉ qua sub-spec |
| --- | --- | --- |
| `D11-B2-attendee-web.md` | **TEMPLATE NOT DISPATCH-READY** | `D11-B2-web-home` · `D11-B2-web-invite` · `D11-B2-web-redeem` |
| `D11-B4-gate-staff-ux.md` | **TEMPLATE NOT DISPATCH-READY** | `D11-B4-ios-staff-scan` · `D11-B4-web-gate` · (± `D11-B4-backend-validate-only`) |
| `D11-B6-a11y.md` | **TEMPLATE NOT DISPATCH-READY** | `D11-B6-web-a11y` · `D11-B6-ios-a11y` |
| `D11-B7-metrics-release.md` | **TEMPLATE NOT DISPATCH-READY** | `D11-B7-backend-metrics` · `D11-B7-coordinator-release-docs` |

**Quy tắc:** một Issue / một Dispatch / một ownership slice. Contract/OpenAPI/schema **không** auto-approved từ Task UX — mọi đề xuất contract = escalate coordinator + user duyệt.

### 5.2 Themes gộp (cho board Epic con — tùy user chọn độ rộng khi review roadmap)

| Theme board | BA stories | Spec IDs | Ghi chú |
| --- | --- | --- | --- |
| Trust & release | S-P0-D | `D11-B1` | Privacy live + ASC; không submit mặc định |
| Guest / attendee | S-P0-F, S-P1-A, (± C brand AC) | `D11-B2-web-*` / `B3` | Home **hoặc** invite **hoặc** redeem — **1 web Dispatch**; parent B2 = template |
| Staff / Gate | S-P0-B, (± S-P1-C optional) | `D11-B4-ios-*` / `D11-B4-web-*` | Offline clarity trước validate-only; parent B4 = template |
| Admin ops | S-P0-E, S-P1-B | `D11-B5` | IA theo job — **không** skin-only; gắn brand AC nếu trong scope |
| Measure / close | metrics, milestone | `D11-B7-*` / `B8` | BE metrics soft-dep BA §10; parent B7 = template |

### 5.3 Quy tắc Dispatch (WIP ownership)

- Cùng lúc tối đa **một** feature Dispatch `web`, **một** `ios`, **một** `backend` (+ docs/reviewer độc lập).
- Ready queue: nếu nhiều Task web P0 (invite, home, admin, privacy) → **xếp hàng**; không `S2 ∥ S5 ∥ S6` cùng wave.
- Reviewer-dod: song song được trên nhiều PR **khác** SHA khi room.

### 5.4 Task Spec skeleton

Mỗi Task coding sau duyệt: Role ID + path `docs/agents/roles/<id>.md`; một ownership path; AC + evidence headless; proof limits; agent cursor. Chi tiết: `docs/tasks/d11/D11-B*.md`.

---

## 6. Dependencies & wave đề xuất (pha B — sau duyệt)

```text
User review roadmap (BA §12 khuyến nghị + plan) + duyệt IN
        │
        ▼
 PD handoff + prototype đủ 6 files (gồm staff-scan.html; PD prototype headless 29/29 PASS — ≠ runtime/app QA)
        │
        ├──► Wave coding #1 (max 1/slice):  web[P0 chọn 1 sub-spec]  ∥  ios[D11-B4-ios-staff-scan]  ∥  backend?  ∥  reviewer(s)
        │         web candidates (ready queue, không song song): B2-web-home | B5 admin | B2-web-invite | B1 privacy*
        │         ❌ Không worker-start parent B2/B4/B6/B7 (TEMPLATE NOT DISPATCH-READY)
        │
        ├──► Wave #2: web[P0 tiếp theo] ∥ ios[brand AC trên B3 / redeem] ∥ reviewer
        │
        └──► Metrics B7-backend khi user muốn đo — deps = BA §10 defs (soft); KHÔNG chờ hết UI P0 nếu BE free
                 │
                 ▼
            B8 milestone gate khi đủ Stories đã chọn
```

\* **Privacy production:** chỉ publish khi **nội dung policy đã được user/legal duyệt**. O06 chưa chốt số → **không** ingest PII thật và **không** ship copy retention bịa; Task privacy có thể soạn bản nháp **local/docs** nhưng Status public URL giữ Bị chặn / chưa deploy đến khi duyệt. Không dùng nhãn “policy TBD” trên production.

**Wave #1 ví dụ (khuyến nghị suy luận, user chỉnh):**

| Slot | Task | Role |
| --- | --- | --- |
| web | **Một** trong: S-P0-F home (nhanh, khớp evidence tươi) **hoặc** S-P0-E admin IA (pain lớn) | `web` |
| ios | `D11-B4-ios-staff-scan` (S-P0-B offline queue clarity) | `ios` |
| docs/ops | ASC/privacy prep (không deploy) nếu user ưu tiên store path | coordinator |
| review | `reviewer-dod` × N PR độc lập | `reviewer-dod` |

**Không** serialize giả: ios P0 không chờ web admin xong; backend metrics không chờ hết web P0 nếu chỉ cần BA defs.

---

## 7. Production readiness checklist gắn D11 (đánh giá — không tự đóng)

| Gate | Owner đề xuất | Trạng thái lúc draft | Ghi chú |
| --- | --- | --- | --- |
| O06 retention/region/SLA | Product + ops (user) | **Mở** | Chặn PII thật; BA Q3 |
| Privacy policy URL live | web + deploy authorize | **404 tươi** baseline | Nội dung phải duyệt trước publish; không “TBD” trên prod |
| Account deletion UX rõ | web/ios | Shell D6; PD account state | |
| Guest home production-lite | web | Demo/jargon observed | S-P0-F |
| Admin IA theo job | web | Source + D8 lịch sử | S-P0-E; không skin-only |
| Runbook on-call Gate | ops | Có khung RUNBOOK | PD không thay |
| Rollback / freeze event | ops | RUNBOOK §6 | |
| Monitor/alert symptom | backend/ops | TD §16; pilot evidence riêng | |
| Device UAT matrix | ios + QA | Một phần D5; ≠ D11 discovery PASS | |
| Store submit | — | Prep ≠ submit (D10) | Ủy quyền riêng |
| Unmeasured metrics | BA §10 | **Chưa đo** | B7 chỉ sau user muốn đo |

---

## 8. Spec sẵn sàng cho coordinator (sau review)

Xem thư mục [`docs/tasks/d11/`](../tasks/d11/):

| File | Mục đích |
| --- | --- |
| `README.md` | Index + quy ước Status |
| `D11-A1-ba-research.md` | Spec BA (đang chạy #224) |
| `D11-A2-pd-design.md` | Spec PD (đang chạy #225) |
| `D11-A3-planner.md` | Spec planner (#226) |
| `D11-A4-reviewer-discovery.md` | Spec reviewer-dod discovery |
| `D11-B*-*.md` | Spec **đề xuất** — parent multi-slice = **TEMPLATE NOT DISPATCH-READY**; chỉ `worker-start` **sub-spec** 1 ownership sau user duyệt |
| `D11-S-P0-C-brand-test-ac.md` | AC brand-test dùng chung (gắn vào B2/B3/B5 surface) |

---

## 9. Việc coordinator làm (planner không làm)

1. Đồng bộ Project Status theo sự kiện (chỉ coordinator đổi board).
2. Sau research complete: đưa package cho **user review** roadmap/Issues pha B.
3. Sau duyệt: tạo/gắn Issues triển khai, `worker-start --agent cursor` theo wave + Role.
4. Không merge/deploy/store trừ ủy quyền.
5. Reuse/release workers theo mailbox rules.

---

## 10. Nhật ký reconcile BA/PD

| Thời điểm | BA | PD / prototype | Hành động planner |
| --- | --- | --- | --- |
| 2026-10-18 sớm | Chưa có | Prototype dirs rỗng | Draft plan giả thuyết |
| 2026-10-18 reconcile #1 (~16:43Z) | Có #224 | Handoff + hub/redeem/admin; lúc đó thiếu staff-scan; PD còn BA_MISSING | Map BA→`D11-B*`; sửa wave; privacy không TBD prod |
| 2026-10-18 reconcile #2 (final) | BA frozen; reviewer PASS w/ known gap research-only | Prototype đủ 6 files; PD đã bỏ BA_MISSING | Bỏ gap staff/BA_MISSING khỏi kết luận hiện tại; §12 = 4 quyết định; S-P1-C optional |
| 2026-10-18 planner fix #226 (reviewer ctx_d3dee44e376d) | — | Prototype đủ 6 files (`staff-scan.html` có); PD form fixes done — headless 29/29 PASS + PD review PASS w/ known gap | (1) §5.1 bỏ stale “thiếu staff-scan”; (2) B2/B4/B6/B7 = TEMPLATE + sub-specs 1 slice; (3) S-P0-C thêm AC cụ thể + file checklist; proof limit: prototype ≠ runtime |

**Khớp BA↔PD (suy luận reconcile):** Admin IA + readiness, Gate offline/conflict, redeem, guest home production-lite, brand-test — **thẳng hàng**. Path PD chính thức: `D11-PRODUCTION-UX-UI.md`. S-P1-C validate-only = **optional** sau roadmap review + capability check. Prototype headless QA ≠ runtime/app QA.

---

## 11. Kết luận khuyến nghị (cho user review)

1. **Pha A đủ Gate (1)–(3) trên disk (local, chưa commit):** BA (+ docs review PASS w/ known gap) + PD prototype đủ + plan/specs `D11-B*`. Gate (4) = user review roadmap trước coding.
2. **Review roadmap** theo BA §12 (4 quyết định khuyến nghị): ưu tiên Admin IA + attendee copy + Gate feedback + a11y; O06/home/pilot tách.
3. **Không** coi D0–D10 Hoàn thành / UI prototype = pilot ready; O06 + privacy duyệt + device/ops là cổng riêng (BA G-A…G-E).
4. **Wave coding sau duyệt:** ≤1 web + ≤1 ios feature; P0 khuyên: ios `D11-B4-ios-staff-scan` ∥ một web (`D11-B2-web-home` **hoặc** `D11-B5`); **không** dispatch parent B2/B4/B6/B7.
5. Role + exact-SHA DoD; cấm EAS Cloud / SaaS / O10-hủy; không tự deploy/store; brand-test AC theo `D11-S-P0-C-brand-test-ac.md`.
