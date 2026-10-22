# D11 — Implementation tracker (pha coding sau duyệt)

| Trường | Giá trị |
| --- | --- |
| Epic | [#222](https://github.com/hangndat/ticket-solution/issues/222) |
| Discovery Story | [#223](https://github.com/hangndat/ticket-solution/issues/223) |
| Authority duyệt | User “duyệt” 18/10/2026 · [`D11-REVIEW-PACKAGE.md`](./D11-REVIEW-PACKAGE.md) · comment trên #222 |
| Plan discovery | [`D11-UX-PRODUCTION-PLAN.md`](./D11-UX-PRODUCTION-PLAN.md) |
| BA / PD | [`D11-BA-RESEARCH.md`](./D11-BA-RESEARCH.md) · [`D11-PRODUCTION-UX-UI.md`](../design/D11-PRODUCTION-UX-UI.md) |
| Task specs | [`docs/tasks/d11/`](../tasks/d11/) |
| Agent | `--agent cursor` ([orca-agent-routing](../../.cursor/rules/orca-agent-routing-coordinator.mdc)) |
| Planner | Không coding role; file này = ready queue + Issue matrix cho **coordinator gốc** |
| Baseline source (discovery) | `3e61cde42d55654897048d6d627ab6834b54b808` — **không** = SHA coding tip |
| Tracker soạn tại HEAD | `dd94f4116f55b5deb77c893860356fe32a77b8aa` (branch docs; không chứng minh runtime) |

**Phân biệt:** research/design complete ≠ code complete ≠ acceptance complete ≠ pilot ready. Prototype (`docs/design/d11-prototype/**`) = gợi ý composition/state fixture — **không** production logic, **không** thay headless UAT trên `apps/**`.

---

## 0. Phạm vi đã duyệt vs OUT

### IN (được thực thi từ phê duyệt này)

| Theme | BA | PD | Spec dispatch | Ownership |
| --- | --- | --- | --- | --- |
| Admin job / workspace / readiness | S-P0-E, S-P1-B | §1.2, §2.3, AC-M1…M3 | `D11-B5` | `web` |
| iOS Gate feedback / offline / conflict | S-P0-B | §1.3, §2.4, AC-G1…G3 | `D11-B4-ios-staff-scan` | `ios` |
| Attendee web home | S-P0-F | §6.1 guest, first viewport | `D11-B2-web-home` | `web` |
| Attendee web redeem / claim / ticket | S-P1-A | §1.1, §2.1–2.2, AC-A1…A4 | `D11-B2-web-redeem` | `web` |
| Attendee iOS ví / redeem / events (+ brand) | attendee iOS + S-P0-C | §1.1, §2.2, §6.3 | `D11-B3` | `ios` |
| Web Gate fallback clarity (nếu còn gap sau W1) | S-P0-B web | AC-G4 | `D11-B4-web-gate` | `web` |
| Brand-test đa tenant | S-P0-C | §6.3 | AC dùng chung — **gắn** B5/B2/B3 | theo surface |
| A11y residual trên bề mặt đợt | PD §3 | A1–A10 | `D11-B6-web-a11y` / `D11-B6-ios-a11y` (hoặc gộp PR surface nếu cùng slice) | `web` / `ios` |
| Milestone evidence đợt | — | — | `D11-B8` | coordinator |

### OUT (không tự mở từ phê duyệt này)

| OUT | Spec / note |
| --- | --- |
| Validate-only / manual lookup | `D11-B4-backend-validate-only` · BA S-P1-C — **giữ đóng** |
| Instrumentation / metrics mới | `D11-B7-*` — **giữ đóng** |
| O06 số liệu retention/region/SLA | DECISION-LOG O06 — không tự điền |
| Privacy publish / production deploy / store submit | `D11-B1` publish + deploy/store — **cần ủy quyền riêng** |
| Invite Owner onboarding | `D11-B2-web-invite` (S-P0-A) — **ngoài gói duyệt lần này** |
| Contract/OpenAPI/schema mới | escalate coordinator + user; **không** auto-approve |
| Android / payment / refund / transfer / seat / Wallet | O10 |
| EAS Cloud Build | chính sách iOS |
| Parent multi-slice templates | `D11-B2` / `B4` / `B6` / `B7` = **TEMPLATE NOT DISPATCH-READY** |

---

## 1. Gate trước feature launch (coordinator)

| # | Điều kiện | Ghi chú |
| --- | --- | --- |
| G0 | Docs PR #227 (discovery package) — CI xanh + DoD docs độc lập + merge khi đủ | **Không** sửa files đang review PR #227 từ tracker này |
| G1 | Backpressure Project #3: nếu ≥3 `Chờ duyệt` / ≥5 PR mở thiếu DoD → **ưu tiên review/fix/merge**, chưa `worker-start` feature coding mới | Observed tại lúc lập tracker: hàng đợi docs/review đang đầy — **chờ G0** trước wave coding |
| G2 | Coordinator tạo GitHub Issues (Story + Task) từ ma trận §2, gắn ID vào cột `Issue` | Planner **không** spawn / không board edit |
| G3 | Mỗi Task: 1 ownership · 1 branch · Role ID trong Spec · agent cursor | ≤1 feature Dispatch / slice (`web`∥`ios`) |

---

## 2. Ma trận Issue / Task / AC

> Issue đã tạo trên Project #3; trạng thái động lấy từ board, không suy diễn từ checklist trong tài liệu.

### 2.1 Stories đề xuất (board)

| Story key | Tiêu đề đề xuất (VI) | Parent | Issue |
| --- | --- | --- | --- |
| D11-S-ADMIN | Admin theo việc + readiness | Epic #222 | `#228` |
| D11-S-GATE | Gate staff feedback / offline / conflict (+ web fallback nếu cần) | Epic #222 | `#230` |
| D11-S-ATT | Attendee nhận vé / QR / recovery (web + iOS) | Epic #222 | `#233` |
| D11-S-QUAL | Brand-test + a11y + milestone evidence đợt | Epic #222 | `#236` |

### 2.2 Tasks coding / evidence (dispatch-ready)

| Task key | Spec file | Role | Ownership paths | Parent Story | BA | PD AC / states | Brand AC | Issue | Deps thật |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D11-T-WEB-ADMIN | [`D11-B5-admin-ops-ux.md`](../tasks/d11/D11-B5-admin-ops-ux.md) | `web` | `apps/web` admin workbench / readiness | D11-S-ADMIN | S-P0-E, S-P1-B | AC-M1, AC-M2, AC-M3 · §2.3 | Gắn [`D11-S-P0-C`](../tasks/d11/D11-S-P0-C-brand-test-ac.md) trên chrome admin/event | `#229` | Soft PD/BA only — **không** chờ iOS |
| D11-T-IOS-GATE | [`D11-B4-ios-staff-scan.md`](../tasks/d11/D11-B4-ios-staff-scan.md) | `ios` | `apps/mobile` staff scan / queue | D11-S-GATE | S-P0-B | AC-G1, AC-G2, AC-G3 · §2.4 ADR-18 | — | `#231` | Soft PD/BA; ADR-18 sẵn — **không** chờ web admin |
| D11-T-WEB-HOME | [`D11-B2-web-home.md`](../tasks/d11/D11-B2-web-home.md) | `web` | `apps/web` `/` guest chrome | D11-S-ATT | S-P0-F | First viewport · không jargon | Gắn S-P0-C nếu guest brand trong scope | `#234` | Soft PD/BA; **serial cùng slice** sau WEB-ADMIN (WIP web) |
| D11-T-WEB-REDEEM | [`D11-B2-web-redeem.md`](../tasks/d11/D11-B2-web-redeem.md) | `web` | `apps/web` redeem/claim/ticket routes | D11-S-ATT | S-P1-A | AC-A1…A4 · §2.1–2.2 | Gắn S-P0-C nếu event chrome | `#234` | Soft PD/BA; serial sau WEB-HOME (cùng `web`) — **không** hard-dep iOS |
| D11-T-IOS-ATT | [`D11-B3-attendee-ios.md`](../tasks/d11/D11-B3-attendee-ios.md) | `ios` | `apps/mobile` events / redeem / ví / ticket QR | D11-S-ATT | attendee iOS + S-P0-C | §1.1, §2.2 | **Bắt buộc** gắn S-P0-C (≥2 tenant iOS) | `#235` | Soft PD/BA; **serial cùng slice** sau IOS-GATE — ∥ web attendee |
| D11-T-WEB-GATE | [`D11-B4-web-gate.md`](../tasks/d11/D11-B4-web-gate.md) | `web` | `apps/web` `/gate` only | D11-S-GATE | S-P0-B web | AC-G4 · không giả queue iOS | — | `#232` | **Chỉ mở nếu** audit tip `main` còn gap fallback web sau W1; không hard-dep IOS-GATE |
| D11-T-WEB-A11Y | [`D11-B6-web-a11y.md`](../tasks/d11/D11-B6-web-a11y.md) | `web` | routes đã chạm B5/B2/B4-web | D11-S-QUAL | PD §3 | A1–A10 residual | — | `Gắn #229/#234/#232` | Sau merge surfaces web đợt **hoặc** gộp vào PR surface cuối nếu cùng branch — không ∥ feature web khác |
| D11-T-IOS-A11Y | [`D11-B6-ios-a11y.md`](../tasks/d11/D11-B6-ios-a11y.md) | `ios` | screens đã chạm Gate + attendee | D11-S-QUAL | PD §3 + HIG | label/focus/VoiceOver residual | — | `Gắn #231/#235` | Tương tự web a11y trên slice `ios` |
| D11-T-MILESTONE | [`D11-B8-milestone-gate.md`](../tasks/d11/D11-B8-milestone-gate.md) | coordinator | evidence + Project sync | D11-S-QUAL | — | Headless UAT + local iOS build + reviews exact SHA | — | `Coordinator gate #236` | Hard: Stories IN đã chọn merge + CI xanh + artifacts |

### 2.3 Review Tasks (spawn khi PR `Chờ duyệt`)

| Review key | Role(s) | Trigger | Artifact đề xuất | Issue |
| --- | --- | --- | --- | --- |
| D11-R-WEB-ADMIN | `reviewer-dod` · ± `reviewer-security` nếu support grant / membership UI | PR tip SHA của `#229` | `docs/reviews/D11-WEB-ADMIN-DOD.md` | `TBD-R-WEB-ADMIN` |
| D11-R-IOS-GATE | `reviewer-dod` · **`reviewer-security` bắt buộc** (check-in / offline sync) | PR tip SHA của `#231` | `docs/reviews/D11-IOS-GATE-DOD.md` | `TBD-R-IOS-GATE` |
| D11-R-WEB-HOME | `reviewer-dod` | PR tip SHA `#234` | `docs/reviews/D11-WEB-HOME-DOD.md` | `TBD-R-WEB-HOME` |
| D11-R-WEB-REDEEM | `reviewer-dod` · ± security nếu đụng auth redeem | PR tip SHA `#234` | `docs/reviews/D11-WEB-REDEEM-DOD.md` | `TBD-R-WEB-REDEEM` |
| D11-R-IOS-ATT | `reviewer-dod` | PR tip SHA `#235` | `docs/reviews/D11-IOS-ATT-DOD.md` | `TBD-R-IOS-ATT` |
| D11-R-WEB-GATE | `reviewer-dod` · ± `reviewer-security` (Gate authz) | PR tip SHA `#232` (nếu mở) | `docs/reviews/D11-WEB-GATE-DOD.md` | `TBD-R-WEB-GATE` |
| D11-R-A11Y-WEB / IOS | `reviewer-dod` | PR tip SHA a11y Tasks | `docs/reviews/D11-*-A11Y-DOD.md` | `TBD-R-A11Y-*` |
| D11-R-MILESTONE | `reviewer-dod` trên SHA tích hợp | Sau merge đủ Stories IN | `docs/reviews/D11-MILESTONE-DOD.md` | `TBD-R-MILESTONE` |

**Review independence:** session reviewer ≠ implementer; exact SHA bắt buộc; thiếu GitHub Approve UI ≠ thiếu Orca DoD nếu có artifact exact-SHA.

---

## 3. Wave bề rộng tối đa (sau G0–G2)

```text
[G0 PR#227 merge + backpressure xuống ngưỡng]
        │
        ▼
Wave 1 (max fan-out ownership):
   web:  D11-T-WEB-ADMIN     ∥   ios: D11-T-IOS-GATE
   + reviewer(s) khi PR sẵn sàng (khác session)
        │
        ▼
Wave 2:
   web:  D11-T-WEB-HOME → rồi D11-T-WEB-REDEEM (serial cùng slice)
         ∥
   ios:  D11-T-IOS-ATT (sau IOS-GATE settle/merge hoặc slot free cùng slice)
        │
        ▼
Wave 3 (điền theo gap thật):
   web:  D11-T-WEB-GATE (chỉ nếu AC-G4 còn fail trên tip)
   web∥ios: D11-T-WEB-A11Y / D11-T-IOS-A11Y (hoặc đã gộp surface)
   coordinator: D11-T-MILESTONE (headless UAT real API + local iOS build evidence)
```

### 3.1 Wave 1 — ready ngay khi G0–G2 xong

| Slot | Task key | Role | Lý do IN wave | Loại khỏi wave nếu |
| --- | --- | --- | --- | --- |
| web | D11-T-WEB-ADMIN | `web` | Approved P0 admin IA + readiness | Đang có feature Dispatch web khác |
| ios | D11-T-IOS-GATE | `ios` | Approved P0 Gate offline/conflict | Đang có feature Dispatch ios khác |
| review | — | `reviewer-dod` (+ security Gate) | Khi PR Chờ duyệt | Chưa có tip SHA |

**Không có hard-dep giữa WEB-ADMIN và IOS-GATE.**

### 3.2 Wave 2 — attendee (sau slot ownership free)

| Slot | Task key | Role | Deps |
| --- | --- | --- | --- |
| web | D11-T-WEB-HOME rồi D11-T-WEB-REDEEM | `web` | WIP: một feature web tại một thời điểm |
| ios | D11-T-IOS-ATT | `ios` | WIP ios; ∥ web attendee OK |

### 3.3 Wave 3 — gap-fill + quality + milestone

| Task | Điều kiện mở |
| --- | --- |
| D11-T-WEB-GATE | Audit `/gate` tip còn thiếu AC-G4 (banner offline + disable confirm; không giả queue) |
| D11-T-*-A11Y | Residual sau surfaces; có thể gộp PR nếu cùng ownership và chưa merge |
| D11-T-MILESTONE | Đủ Stories IN merge + CI; thu headless UAT + local iOS build |

---

## 4. AC nghiệm thu gắn PD (checklist copy vào Issue)

### 4.1 D11-T-WEB-ADMIN

- [ ] Job nav: Chuẩn bị | Khách & mã | Cổng | Hỗ trợ (AC-M3)
- [ ] Progressive disclosure; UUID/mã đợt không chiếm chrome chính khi có slug/tên
- [ ] Readiness: Publish tắt khi thiếu nguồn/loại vé; hạn mức = số **hoặc** «không giới hạn» tường minh (AC-M1, §2.3)
- [ ] Unclear save/timeout ≠ tick xanh giả (AC-M2)
- [ ] Brand-test S-P0-C trên admin/event chrome (≥2 tenant) khi surface trong PR
- [ ] `scripts/web-uat.sh` admin scope + artifacts `apps/web/.uat-artifacts/`
- [ ] `reviewer-dod` exact SHA (± security nếu grant/support)

### 4.2 D11-T-IOS-GATE

- [ ] States UI: idle/loading/admitted/denied/unknown/queued/DUPLICATE/CONFLICT/offline (AC-G1…G3)
- [ ] Queued ≠ admit tone; CONFLICT ≠ lượt vào mới; copy VI
- [ ] Không invent sync API; giữ O05/ADR-18; tests check-in hiện có PASS
- [ ] `scripts/sim-uat.sh` + artifacts `apps/mobile/.uat-artifacts/`
- [ ] `reviewer-dod` + `reviewer-security` exact SHA
- [ ] **Proof:** sim ≠ device camera/venue — xem §6

### 4.3 D11-T-WEB-HOME

- [ ] Không lộ Nest/BFF/fixture jargon trên đường khách; DEMO nhãn rõ
- [ ] Brand-first first viewport; CTA chính rõ
- [ ] Brand-test S-P0-C nếu guest brand trong scope
- [ ] `scripts/web-uat.sh` home + artifacts
- [ ] `reviewer-dod` exact SHA

### 4.4 D11-T-WEB-REDEEM (claim / ticket)

- [ ] Auth thiếu → «Cần đăng nhập» / email verified (AC-A3) — **không** mở anonymous
- [ ] Issued → thẻ vé/QR; unknown → không vé giả + kiểm tra lại (AC-A1, AC-A2)
- [ ] Stale form (`FORM_VERSION_STALE`/409) → tải lại + đồng ý lại (AC-A4)
- [ ] Copy VI plain; brand-test nếu event chrome
- [ ] `scripts/web-uat.sh` redeem success/error JSON khi có
- [ ] `reviewer-dod` exact SHA (± security auth)

### 4.5 D11-T-IOS-ATT

- [ ] Events / redeem / ví / ticket QR theo PD §1.1–§2.2 trong màn được chọn Issue
- [ ] Offline display: «Đang xem vé đã lưu — chưa kết nối» (không claim sync mới)
- [ ] Brand-test S-P0-C ≥2 tenant trên iOS (bắt buộc đợt này)
- [ ] `scripts/sim-uat.sh` + local prebuild/xcodebuild nếu Task yêu cầu binary — Team `BLUA62D52G`, **cấm** EAS Cloud
- [ ] `reviewer-dod` exact SHA

### 4.6 D11-T-WEB-GATE (optional)

- [ ] Offline/degraded banner; disable confirm (AC-G4)
- [ ] Không giả offline queue iOS trên web
- [ ] `scripts/web-uat.sh` `/gate` + `reviewer-dod` (± security)

### 4.7 A11y + Milestone

- [ ] Web/iOS residual PD A1–A10 trên routes/screens đã chạm; ghi manual vs automated
- [ ] Milestone: headless UAT real API theo §5; local iOS build evidence; reviews exact SHA; **không** deploy/store; O06 vẫn mở → không tuyên bố PII/pilot ready

---

## 5. Headless UAT real API — phương án ports / sims

> Prototype file:// **không** dùng cho AC coding. Mỗi Task ghi port/sim riêng; **không** chiếm simulator/DB của worker khác.

| Surface | Command khung | Ports / env (đề xuất) | Artifact |
| --- | --- | --- | --- |
| Web admin / home / redeem / gate | `scripts/web-uat.sh` / `node scripts/web-uat.mjs` (Playwright **headless**) | `WEB_UAT_BASE_URL` → stack local Task (vd. web `3xxx`, api `4xxx` — **điền số cụ thể trong Issue khi spawn**); cookie/OIDC fixture đã có sẵn repo nếu đủ; không headed trừ user yêu cầu | `apps/web/.uat-artifacts/d11-<task>/` |
| iOS Gate / attendee | `scripts/sim-uat.sh` (+ AXe HID) | UDID sim **riêng Task** (`sim-uat boot`); api base URL Task-specific; Team `BLUA62D52G` | `apps/mobile/.uat-artifacts/d11-<task>/` |
| Brand-test | Cùng scripts | ≥2 tenant/event brand khác nhau trên tip đang duyệt | Screenshot crop + SHA trong DoD |

**Real API:** ưu tiên gọi API/BFF thật của stack local Task (seed/demo labelled). Fixture UI chỉ khi route chưa có backend — phải nhãn DEMO, không giả production policy.

**Evidence tối thiểu mỗi PR coding:** lệnh + exit 0 (hoặc ghi rõ partial) · path artifact · exact tip SHA · proof limits.

---

## 6. Device test vs simulator — không tự miễn

| Task | Simulator / headless đủ cho DoD Task? | Cần fresh device trước claim rộng hơn |
| --- | --- | --- |
| D11-T-WEB-* | Có (Playwright headless) cho AC UI/copy/state | Device browser thật = optional polish; không chặn merge Task nếu headless PASS |
| D11-T-IOS-GATE | Sim đủ cho copy/state/queue UX + regression tests | **Device + camera thật** bắt buộc trước claim venue/pilot / “scan production-ready” — **không** miễn bằng sim |
| D11-T-IOS-ATT | Sim đủ cho ví/redeem/events chrome + brand-test sim | Device: push regression chỉ khi đổi push path (tái dùng D5 DELIVERED nếu không regress); Wallet/store = OUT |
| D11-T-MILESTONE | Headless web + sim iOS + **local** xcodebuild | Device/venue/user study = gate pilot riêng — **không** tự đóng bằng milestone UI |

---

## 7. DoD / security review — skeleton Spec (copy khi spawn)

```markdown
## Vai trò chuyên môn
- Role ID: reviewer-dod
- File: docs/agents/roles/reviewer-dod.md
- Agent: cursor
- (± Role ID: reviewer-security · docs/agents/roles/reviewer-security.md) khi Gate/check-in/authz

## Review independence
- Implementer session/dispatch: <id>
- Reviewer session ≠ implementer
- Exact SHA: <40-char tip PR>
- Scope: Issue #… · PR #… · paths apps/web|apps/mobile only
- Artifact: docs/reviews/D11-<SLUG>-DOD.md

## Checklist
- [ ] AC Issue (map PD §4 / tracker §4) đủ evidence
- [ ] Không mở OUT §0 (validate-only, metrics, O06 số, deploy/store, contract tự ý)
- [ ] Headless/sim commands trên đúng SHA; proof limits ghi rõ
- [ ] Brand-test S-P0-C nếu surface yêu cầu
- [ ] Security (nếu gắn): không nới check-in/offline invariants; không lộ secret
- Verdict: PASS | FAIL | PASS with known gap (gap không được miễn gate bắt buộc)
```

---

## 8. Actionable queue cho coordinator (thứ tự)

1. **Không** `worker-start` feature coding cho đến G0 (PR #227 CI + DoD docs + merge) và backpressure xuống ngưỡng.
2. Tạo Stories `TBD-STORY-*` + Tasks `TBD-T-*` trên Project #3; điền số Issue vào bảng §2; link Spec path + Role.
3. Wave 1 cùng lúc: `#229` (`web`) ∥ `#231` (`ios`) — Spec từ `docs/tasks/d11/` + AC tracker §4 + brand/security notes.
4. Khi PR Chờ duyệt: spawn reviewer độc lập theo §2.3 (Gate = dod+security).
5. Wave 2: attendee web serial (HOME → REDEEM) ∥ ios ATT khi slot free.
6. Wave 3: WEB-GATE chỉ nếu gap AC-G4; a11y residual; rồi `Coordinator gate #236`.
7. **Không** mở B1 publish, B4-backend-validate-only, B7 metrics, invite, deploy/store từ tracker này.

### WIP / idle fill

- ≤1 feature Dispatch / ownership slice.
- Hàng đợi duyệt đầy → fill reviewer/fix trước feature mới (`github-project-tracking` + `orca-idle-worker-fill`).
- Planner kết thúc sau khi file này đủ; **không** retain chờ code.

---

## 9. Source / graph note

- Graph `code-review-graph-ticket` có thể stale vs HEAD — dùng để hẹp phạm vi; **source wins**.
- Coding workers xác minh `apps/web` / `apps/mobile` trên tip Task trước claim UAT; screenshot D8 / prototype QA ≠ runtime pass.

---

## 10. Handoff planner → coordinator

| Deliverable | Path / trạng thái |
| --- | --- |
| Tracker + matrix + waves + DoD skeletons | **file này** |
| Spec ownership chi tiết | `docs/tasks/d11/D11-B*.md` (sub-spec; không dispatch parent template) |
| PD AC nguồn | `docs/design/D11-PRODUCTION-UX-UI.md` §2–§4 |
| Brand AC dùng chung | `docs/tasks/d11/D11-S-P0-C-brand-test-ac.md` |
| Issue GitHub numbers | #228–#237; brand/a11y gắn theo surface |
| Feature coding | Đã dispatch #229 web admin và #231 iOS Gate; #237 hỗ trợ fixture UAT |

**Planner done criteria:** tracker actionable + queue §8 + review/UAT specs đủ để gắn ID — **không** chờ implementers; không commit/push/PR/merge/board/spawn từ session planner này.

## Checkpoint coordinator — bắt đầu thực thi

PR #227 đã merge `e8512d0055e0e9d6585007e8363b6224a7138b12`, exact tip review `dd94f4116f55b5deb77c893860356fe32a77b8aa`, review độc lập PASS with known gap, CI tip docs-only PASS. Các phần tracker `TBD-R-*` là reviewer session cho cùng Issue, không cần tạo Issue sản phẩm trùng. Web attendee home/redeem/claim/ticket được gộp một coherent ownership Task #234. Các Task a11y tích hợp vào Task surface; không mở scope riêng ngoài UX/UI đã duyệt.

UAT support #237: project local riêng `ticket-d11-uat`, API4111/OIDC18091, worker backend `ctx_740b03418177`. Không thực thi feature backend; chỉ fixture/devinfra. Mọi credential/data là fixture local; không đụng DB/simulator Run khác.

### Checkpoint triển khai — 18/10/2026

- CI tích hợp trên `e8512d0055e0e9d6585007e8363b6224a7138b12` đã xanh; discovery #223–#226 đã đóng.
- #229: Cursor `ctx_ea235757583f`, branch `hangndat/d11-web-admin`, web port 3111, đang triển khai.
- #231: Cursor `ctx_fcb26ae7ed3a`, branch `hangndat/d11-ios-gate`, Metro 8111, simulator riêng `D11-Gate-UAT`, đang triển khai và chuẩn bị local build.
- #237: Cursor `ctx_740b03418177`, fixture stack riêng `ticket-d11-uat`, chưa có handoff xác nhận tại checkpoint này. iOS đã hỏi config local; coordinator yêu cầu backend ưu tiên handoff.
- Chưa có PR feature được nghiệm thu; chưa đủ evidence để đóng Epic hoặc tuyên bố pilot ready.

- #229 code complete trên PR #238, SHA `8cb02639302cd717ee1460611819aa8ab26400e4`; Project chuyển Chờ duyệt. Typecheck/lint/148 tests/build và headless UI fixture PASS; real API UAT chưa có. Reviewer độc lập `ctx_e14d9f6a7801` đang kiểm tra AC và visual thực tế. Implementer đã release.
- #237 attempt `ctx_740b03418177` bị process killed (terminal evidence); đã stop và retry cùng Task bằng `ctx_47378881bb51`. Không tạo Task fixture trùng.
