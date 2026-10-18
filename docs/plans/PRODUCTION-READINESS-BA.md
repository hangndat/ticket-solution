# Production readiness — BA nghiên cứu (không coding)

| Trường | Giá trị |
| ------ | ------- |
| Role | `product-ba` — [`docs/agents/roles/product-ba.md`](../agents/roles/product-ba.md) |
| Ownership | **Chỉ** file này |
| Ngày | 2026-10-18 |
| Task / Dispatch | Research: `task_067a3392a050` / `ctx_bdc9363309a2` · Errata: `task_8d18b65e1ec9` / `ctx_b4e0fe5f2a1b` |
| Architecture impact | **Không** — AC/policy/ops; quyết định kỹ thuật giao `architect` |
| Ngôn ngữ | Tiếng Việt (giữ ID, path, SHA, URL nguyên bản) |
| Trạng thái | **Đề xuất** — không claim PASS / pilot ready / production ready |

> **Errata (2026-10-18, [#373](https://github.com/hangndat/ticket-solution/issues/373)):** Snapshot research này **stale một phần**. Nguồn quyết định hiện tại: [`GAP-AUDIT-2026-10-18-INDEX.md`](../reviews/GAP-AUDIT-2026-10-18-INDEX.md) (+ BA/ARCH/DOD/PD/SECURITY cùng đợt). **Không còn mở như claim cũ:** D11 / [#254](https://github.com/hangndat/ticket-solution/issues/254) **đã đóng**; O06 **đã chốt**; `GET https://vemoki.com/privacy` → **HTTP 200** (PR-02 stale-as-open). **Còn mở:** Navigation O02 — [#368](https://github.com/hangndat/ticket-solution/issues/368)–[#371](https://github.com/hangndat/ticket-solution/issues/371). Không spawn lại PR-01…03 / UX fixture SoT như feature mới.

### Ranh giới tuyên bố

| Được | Không được |
| ---- | ---------- |
| Gap → evidence → rủi ro → P0/P1/P2 → AC/check → owner → dep → quyết định user | Sửa `apps/**`, commit/push/PR/merge, deploy, store submit |
| Phân biệt fact / inference / recommendation | Hồi sinh Android / payment / seat / Wallet |
| Phân biệt code / acceptance / pilot / production ready | Claim PASS khi chưa verify; suy evidence local = đã merge |
| Đề xuất phạm vi tối thiểu + kịch bản nghiệm thu + lựa chọn O06 | Tự chốt số retention/region/SLA |

**Không lặp:** chi tiết JTBD/benchmark UX D11 (`D11-BA-RESEARCH`), day-of lane design (`MVP-EXPAND-BA-A`), residual inventory dài (`MVP-EXPAND-BA-B`), dashboard market (`DASHBOARD-*`). File này **gom cổng đưa production** và hành trình E2E còn hở.

**Hướng dẫn coordinator (msg follow-up):** ưu tiên ~12 gap tác động cao; AC cụ thể; không audit toàn codebase / không feature ngoài MVP; runtime chưa verify ghi rõ; O06 = gói lựa chọn user — **không** mặc định blocker mọi Task coding độc lập (chỉ chặn ingest PII thật / tuyên bố pilot-with-PII / store privacy khớp số).

**Errata follow-up (task `task_8d18b65e1ec9`, 2026-10-18):** Bản trước kết luận “thiếu asOf / consumer O12” từ **local HEAD stale** (`e8512d0…` + `report.ts` cũ trên worktree). Coordinator xác nhận (gh): PR **#250 MERGED** `2026-10-17T19:46:59Z` merge `f0191a2a630453018ff6538d55a5df42f19093d3` (render + asOf); PR **#260 MERGED** `2026-10-17T23:22:52Z` merge `a456c7fb5778de75047779c171dfe9b1e39f7793` (deep-link). Trên `origin/main` `report.ts` **đã có** `asOf` / `emailNeedsCsCount` / `quotaRemaining`. Issue **#245** vẫn **OPEN / Sẵn sàng** → việc còn lại = **reconcile AC/evidence/board**, không phải greenfield missing asOf. Không xin user phê duyệt lại O15/#254 hay invite đã duyệt O14. Gate security/UAT bắt buộc: không hỏi miễn; phân biệt **revalidation trước release** vs **task chưa từng làm**.

### Top 12 gap (điều hành)

| # | ID | Gap | P | Chặn gì? | Không chặn |
| - | -- | --- | - | -------- | ---------- |
| 1 | PR-03 | Public event fixture SoT (web home + iOS demo catalog) | P0 | Trust content production | Coding Gate/CS/Dashboard |
| 2 | PR-05 | Web Gate fail-closed `#232` | P0 | Đóng Story Gate / pilot web fallback | O06 |
| 3 | PR-06 | UAT tích hợp `#236` | P0 | Đóng Epic D11 acceptance | O06 |
| 4 | PR-04 | Invite Owner HTTP prod (CSRF known gap) | P0 | Onboard tenant thật qua UI | Coding #254 BE |
| 5 | PR-01 | O06 chưa chốt số | P0 policy | Ingest PII / DPA / privacy số liệu | `#232` `#245` `#246` `#254` coding |
| 6 | PR-02 | `vemoki.com/privacy` **404** | P0 | Store submit + public legal | Feature D11 còn lại |
| 7 | PR-14 | Support SLA cửa sổ event | P0 ops | Tuyên bố pilot có on-call | Feature coding |
| 8 | PR-09 | Device UAT venue | P0 | Claim pilot/venue / release | Không miễn; demo chỉ ghi “chưa pilot ready” |
| 9 | PR-07 | `#245` OPEN — reconcile AC/DoD/board sau P2 `#250` + P3 `#260` **đã merge** | P1 | Đóng Issue / acceptance consumer | Policy O06; không re-implement asOf |
| 10 | PR-08 | CS email UX `#246` | P1 | CS nhầm ACCEPTED=nhận | Policy O06 |
| 11 | PR-10 | Capacity trên hạ tầng đích | P1 | Công bố SLO tải | Pilot 1-event nhỏ |
| 12 | PR-11/12/13 | Metrics · validate-only · store submit | P2/OUT | Mở rộng sau | MVP path tối thiểu |

Device/security/UAT: bắt buộc khi claim pilot/release; phân biệt revalidation SHA mới vs chưa từng làm — không hỏi miễn.

**Source spot-check (fact, worktree — chưa = runtime prod PASS):**

| Claim | Quan sát source | Runtime |
| ------ | --------------- | ------- |
| Web home listing = fixture | `apps/web/app/page.tsx` import `demoEventRoutes` / `findDemoEvent` | **Chưa xác minh** deploy SHA = tip `main` |
| iOS Events còn demo catalog (dev) | `events.tsx` + `showDemoEventCatalog()`; comment: Release/TF ẩn demo | **Chưa xác minh** binary TF |
| Invite accept UI tồn tại | `apps/web/app/invite/*` → BFF accept; BE `acceptMembershipInvite` | Gap CSRF = evidence **D4 UAT** (lịch sử); **revalidation trước release** còn mở (O14 đã duyệt làm — không xin duyệt lại) |
| Web EventReport O12 P2/P3 trên `main` | `origin/main` `apps/web/src/admin/report.ts` có `asOf` / `emailNeedsCsCount` / `quotaRemaining` (merge #250 `f0191a2…`, #260 `a456c7f…`) | **Không** kết luận missing asOf từ HEAD worktree cũ; `#245` = reconcile remaining AC/evidence/board (**chưa xác minh** runtime prod) |
| Privacy live | curl `https://vemoki.com/privacy` → **404** (2026-10-18) | Fact |

---

## 0. Baseline quan sát (fact)

### 0.1 Git / board

| Mục | Giá trị | Loại |
| --- | ------- | ---- |
| Worktree HEAD | `e8512d0055e0e9d6585007e8363b6224a7138b12` | Fact (local) |
| `origin/main` tip (lúc research) | `2416a94b02acb50a5186309aa619c04fec106317` (`docs(reviews): DoD gate.reject audit #244 (#259)`) | Fact |
| Merge-base HEAD ↔ `origin/main` | `e8512d0…` (= local HEAD) → **main đã tiến trước worktree tip** | Fact |
| Working tree | Dirty lớn: rules, mobile config, PRD/DECISION, **nhiều `docs/reviews/*` và `docs/plans/*` untracked** | Fact |
| Project #3 | 126 item: **114 Hoàn thành** · 5 Đang làm · 3 Sẵn sàng · 2 Bị chặn · 1 Chờ duyệt · 1 Chưa lên lịch (#7 hủy) | Fact (`gh project item-list`, 2026-10-18) |

**Inference:** Nhiều DoD artifact trên disk (`docs/reviews/D11-*.md`, …) **chưa** chứng minh đã trên `main` — chỉ đọc được; không suy merge từ untracked.

### 0.2 Board mở (production-path liên quan)

| Status | Issue | Ghi chú |
| ------ | ----- | ------- |
| Đang làm | #222 Epic D11 UX production | Parent chưa đóng |
| Đang làm | #230 / #232 Web Gate fail-closed | Còn slice Gate web |
| Đang làm | #236 UAT tích hợp D11 | Milestone evidence |
| Sẵn sàng | #233 Story attendee (parent) | Child #234/#235 đã Hoàn thành — parent còn mở |
| Sẵn sàng | #245 Web Dashboard O12 consumer | **OPEN** — P2 #250 + P3 #260 **đã merge** `main`; còn reconcile AC/evidence/board (không = thiếu asOf) |
| Sẵn sàng | #246 Web CS email recovery UX | O14 đã duyệt mở khi slot web |
| Đang làm | #254 Epic nguồn sự kiện từ server | Fixture client vẫn SoT public |
| Chờ duyệt | #255 BE public published list/detail | Unblocks #256/#257 |
| Bị chặn | #256 Web / #257 iOS published-first | Dep #255 |
| Chưa lên lịch | #7 Hủy Android/payment/seat/Wallet | Non-goal cứng |

### 0.3 Public host (fact, curl 2026-10-18)

| URL | HTTP | Ghi chú |
| --- | ---- | ------- |
| `https://vemoki.com/` | **200** | Trang public sống |
| `https://vemoki.com/privacy` | **404** | Vẫn thiếu URL privacy live |

### 0.4 Chính sách còn mở (fact từ docs tracked)

| ID | Trạng thái | Nguồn |
| -- | ---------- | ----- |
| O06 retention / region / SLA | **Giữ mở** — chưa chốt số | `docs/DECISION-LOG.md`, `docs/ops/O06-OPTIONS.md` |
| O14 mở rộng MVP | Đã duyệt: Dashboard O12 + CS UX + reject-audit; OUT validate-only/multi-event/metrics; O06/privacy tạm không ingest PII / không deploy privacy | DECISION-LOG O14 |
| O10 hủy | Android / payment / seat / Wallet | PRD + #7 |
| Store submit / deploy prod | Cần ủy quyền task riêng | ROADMAP / O11 |

---

## 1. Bốn mức sẵn sàng (bắt buộc phân biệt)

| Mức | Nghĩa cho Vemoki | Hiện trạng (inference có kiểm soát) |
| --- | ---------------- | ----------------------------------- |
| **Code complete** | PR merge `main` + CI slice | D0–D10 acceptance trên board; D11 nhiều Task Hoàn thành; Dashboard P2/P3 đã trên `main`; còn #232/#236/#246/#254* + **#245 acceptance/board** | Không = sẵn sàng khách thật |
| **Acceptance complete** | DoD Project: review exact-SHA ≠ implementer + evidence Issue | Parent #222/#230/#233/#236/#254 **chưa** Hoàn thành | Board thắng docs cũ |
| **Pilot ready** | TD/RELEASE: O06 chốt, privacy live, device UAT, restore/runbook, 1–2 tenant vận hành thật (demo PII policy) | **Chưa đạt** — O06 mở, privacy 404, invite prod gap, #254 fixture | |
| **Production ready** | Pilot + ingest PII thật theo O06, support/SLA, capacity evidence trên hạ tầng đích, store path nếu cần phân phối app rộng | **Chưa đạt** — không tuyên bố từ board Hoàn thành D0–D10 |

**Recommendation:** User/ops chỉ tuyên bố mức sau khi đủ cổng tương ứng; cấm nhảy từ “D11 gần xong” → production ready.

---

## 2. Problem / outcome theo persona (production lens)

| Persona | Outcome production | Pain còn hở (tóm tắt) |
| ------- | ------------------ | --------------------- |
| Owner / Agency | Onboard tenant, mời nhân sự HTTP, chạy ≥1 event thật không hardcode | Invite CSRF known gap D4; multi-event overview **OUT**; fixture public (#254) |
| Event Manager | Setup → publish → mở redeem → xem KPI/việc cần làm trong cửa sổ event | asOf/deep-link **đã merge** (#250/#260); #245 còn reconcile board/AC — UAT tích hợp #236 chưa đóng |
| Supervisor | Escalation có audit khi Gate lỗi / nhầm | Day-of UX đề xuất (BA-A) chưa thành Issue bắt buộc; validate-only **OUT** |
| Scanner | Scan nhanh, kết quả rõ, offline/conflict đúng ADR-18 | iOS Gate #231 Hoàn thành; Web Gate #232 còn Đang làm |
| CS | Lookup + timeline + resend; DELIVERED≠ACCEPTED | API sẵn; UX #246 Sẵn sàng |
| Attendee | Discover event published → redeem → QR web/iOS → vào cổng | Attendee Tasks #234/#235 Hoàn thành; **listing/detail public vẫn fixture** (#254) — trust production thấp |
| Platform Operator | Tenant/quota/support grant; không lẫn dữ liệu | D4/D5 acceptance; capacity 50k concurrent **chưa claim** (PRD §9 baseline test only) |

---

## 3. Hành trình E2E × cổng (PRD §7)

Ký hiệu: **OK-A** = acceptance-level evidence trên board/`main` · **GAP** = còn hở production · **OUT** = không làm MVP · **NV** = chưa xác minh runtime trong phiên này.

| # | Bước | Persona | Trạng thái production-path | Evidence / Issue | Ưu tiên |
| - | ---- | ------- | -------------------------- | ---------------- | ------- |
| 1 | Operator tạo 2 tenant; Owner mời nhân sự | Operator / Owner | **GAP** invite HTTP prod (CSRF); path DB bypass từng dùng UAT | `docs/reviews/D4-TENANT2-PROD-UAT.md` (tracked); residual BA-B G1 | **P0** |
| 2 | Manager tạo event, brand, loại vé/nguồn/quota, import | Manager | **OK-A** admin + import D4; D11 admin readiness #229 | Board Hoàn thành D4/#229 | — |
| 3 | Preview / publish / mở đổi vé | Manager | **OK-A** publish config; **GAP** public surface vẫn fixture | #254 Epic + EVENT-SERVER-SOURCE-BA (local) | **P0** |
| 4 | Khách đổi vé web + OTP + email QR | Attendee | **OK-A** redeem D2/D11 #234; email sandbox/ops | DoD local `D11-PR-243-*` **untracked** — NV merge SHA | P1 verify |
| 5 | Cùng user thấy vé trên app | Attendee | **OK-A** #235 | DoD local `D11-PR-248-*` **untracked** | P1 verify |
| 6 | Lưu vé / QR offline | Attendee | **OK-A** D2/D7 surfaces; device venue **NV** | ROADMAP §1.2 proof limits | **P0** nếu claim pilot venue |
| 7 | Staff scan + dashboard cập nhật | Scanner / Manager | **GAP** web Gate #232; dashboard **code** P2/P3 trên `main`, **GAP acceptance** #245 còn OPEN; BE #241/#244 OK-A | Board + merge #250/#260 | **P0** (#232) / **P1** reconcile #245 |
| 8 | Dup scan + Supervisor xử lý | Scanner / Supervisor | **OK-A** invariant check-in; UX exception sâu **OUT/defer** | PRD M10; O14 OUT validate-only | — |
| 9 | CS resend + timeline; Manager export | CS / Manager | **GAP** UX #246; export D4 known MinIO gap lịch sử | Board #246; D4 UAT | **P1** |
| 10 | Tenant 2 brand khác, không lẫn | Owner | **OK-A** D4 Tenant2; brand-test D11 gắn surfaces | D4-TENANT2; S-P0-C | — |
| — | Hậu sự kiện: retention / anonymize / export đối soát | Owner / Ops | **GAP** O06 chưa chốt; metrics PRD §13 **chưa đo** | O06-OPTIONS; O14 metrics OUT | **P0** policy |

---

## 4. Bảng gap → evidence → rủi ro → ưu tiên → AC → owner → dep → quyết định user

> **Evidence SHA:** ghi path; nếu chỉ local/untracked → cột SHA = `local-untracked` hoặc tip `main` đã biết. Không claim PASS.

| ID | Gap | Evidence path / SHA | Rủi ro | P | AC / check đề xuất | Owner | Dep thật | User cần chốt |
| -- | --- | ------------------- | ------ | - | ------------------ | ----- | -------- | ------------- |
| PR-01 | **O06** retention / region / SLA chưa số | `docs/ops/O06-OPTIONS.md`; DECISION-LOG O06 **Giữ mở**; O14 tạm “không ingest PII ngoài demo” | Chặn **ingest PII thật** / DPA / text privacy có số — **không** chặn coding D11/#254/#245/#246 độc lập | **P0 policy** | DECISION-LOG đóng O06 với giá trị đã chọn; runbook cập nhật | User + ops → coordinator ghi log | Không code bắt buộc | Chọn khung §7 bên dưới (hoặc giữ O14 tạm) |
| PR-02 | **Privacy URL live 404** | curl 2026-10-18 `vemoki.com/privacy` **404**; Apple yêu cầu Privacy Policy URL ([App Review 5.1.1](https://developer.apple.com/app-store/review/guidelines/), [ASC App privacy](https://developer.apple.com/help/app-store-connect/reference/app-privacy/)) | Block store submit + trust public | **P0** | HTTP 200 + nội dung khớp retention đã chốt; link trong app | `web` + deploy **ủy quyền** | Soft: nội dung legal; ideally sau/∥ O06 | Duyệt nội dung + ủy quyền deploy? |
| PR-03 | **Public event vẫn fixture client** | Epic #254; `#255` Chờ duyệt; `#256/#257` Bị chặn; BA `EVENT-SERVER-SOURCE-BA.md` (local) | Demo/jargon = không production content path | **P0** | Published list/detail SoT; empty/error fail-closed; fixture không default listing | BE → web ∥ iOS | Hard: #255 merge trước consumer | **Không** xin phê duyệt lại Epic #254 / O15 — tiếp tục thực thi theo board |
| PR-04 | **Invite Owner HTTP prod** | `D4-TENANT2-PROD-UAT.md` CSRF; **O14 đã duyệt** làm sau attendee (#234 xong) | Onboard tenant pilot gãy | **P0** | Given invite link When accept HTTP Then ACTIVE + copy lỗi VI; không SQL bypass | `web` (+ DoD ± security) | Soft: slot web vs #232/#246 / reconcile #245 | **Không** xin duyệt lại O14 — chỉ xếp lịch thực thi + **revalidation** HTTP trước release |
| PR-05 | **Web Gate fail-closed** còn mở | Board `#232` Đang làm; Story `#230` | Staff web fallback giả thành công | **P0** | AC-G4 / Issue #232; headless UAT mất mạng | `web` | Không hard-dep iOS Gate (#231 xong) | — (đã trong D11) |
| PR-06 | **UAT tích hợp D11 / milestone** | `#236` Đang làm | Acceptance Epic #222 chưa đóng | **P0** | Headless web+iOS + local iOS build evidence + exact SHA reviews | coordinator | Stories IN merge | — |
| PR-07 | **Dashboard O12 — reconcile `#245`** | P2 PR #250 merge `f0191a2a630453018ff6538d55a5df42f19093d3`; P3 PR #260 merge `a456c7fb5778de75047779c171dfe9b1e39f7793`; `#245` vẫn OPEN/Sẵn sàng; BE `#241/#244` Hoàn thành | Board/AC chưa khớp code đã merge — **không** = missing asOf trên `main` | **P1** | Đóng remaining AC Issue #245 + DoD exact-SHA trên tip đã integrate + Project → Hoàn thành khi đủ | `web` / coordinator / `reviewer-dod` | Soft: evidence trên merge SHAs trên; không hard-dep re-code asOf | Không phê duyệt lại O12/O14 — reconcile only |
| PR-08 | **CS email recovery UX** | `#246` Sẵn sàng; O14 duyệt mở | CS nhầm ACCEPTED=đã nhận | **P1** | Timeline + copy DELIVERED≠ACCEPTED; resend cooldown | `web` | BE CS API sẵn | Xếp lịch slot web (O14 đã duyệt — không xin lại) |
| PR-09 | **Device UAT venue** (camera/push/offline/revoke) | ROADMAP §1.2; D5 push evidence một phần; headless ≠ device | Claim pilot/venue sai nếu bỏ qua | **P0** khi pilot venue / release claim | Checklist RELEASE iOS device; TF status riêng | `ios` + ops | Local signed archive D10; **cấm** EAS Cloud | **Không hỏi miễn** security/UAT. Phân biệt (a) **revalidation** trước release trên SHA mới vs (b) **chưa từng làm** device matrix — cả hai cần evidence |
| PR-10 | **Capacity / SLO trên hạ tầng đích** | PRD §9 baseline; `RELEASE-CHECKLIST` load drill local | Công bố 50k concurrent sai | **P1** | Load trên staging đồng hình prod; ghi số + hạn chế | backend / ops | Không gắn UX | Chấp nhận “chưa đo prod” có kiểm soát cho pilot nhỏ? |
| PR-11 | **Metrics PRD §13 chưa đo** | O11/O14 OUT instrumentation | Không biết funnel redeem/Gate | **P2** | Định nghĩa metric tối thiểu + owner đo | product + BE nếu mở | User mở lại | Đo trước pilot MFest hay chấp nhận chưa đo? |
| PR-12 | **Validate-only / manual lookup** | O14 OUT; PRD M10 gợi ý | Hàng dài khi QR hỏng | **P2**/OUT | Chỉ sau user mở + capability audit | BE+ios+web | Contract có thể cần | Giữ OUT đến sau pilot 1-event? (**Khuyến nghị: Giữ OUT**) |
| PR-13 | **Store submit** | D10 metadata/archive acceptance ≠ submit | Phân phối app rộng | **P2** | Task ủy quyền riêng; privacy URL đã 200 | coordinator | PR-02 | Submit TF/App Store khi nào? |
| PR-14 | **Support / escalation cửa sổ event** | `O06-OPTIONS` §3; `RUNBOOK.md` | On-call mơ hồ | **P0** (ops) | Kênh + P1 response trong cửa sổ event ghi runbook | User/ops | Song song O06 SLA | Chọn business-hours vs 24/7 cửa sổ event |
| — | Android / payment / seat / Wallet | #7 | Scope creep | **REJECT** | — | — | — | Không mở |

\*Device/security/UAT: **không miễn**. Demo nội bộ chỉ được ghi “Simulator/headless only — **chưa** pilot ready” (không thay device gate). Revalidation trước release ≠ bỏ qua task chưa từng có evidence.

---

## 5. Phạm vi tối thiểu đề xuất để “production-path” (không tự ship)

### 5.1 IN — tối thiểu trước ingest PII / event thật ngoài demo

1. **Đóng policy O06** (PR-01) + **privacy host 200** (PR-02) — hoặc giữ “chỉ demo seed / không PII thật” tường minh.  
2. **#254** published-first public (PR-03) — Admin publish → khách thấy đúng event (đã mở Epic — không xin duyệt lại).  
3. **Invite HTTP revalidate** (PR-04) — Owner onboard không SQL (**O14 đã duyệt** — xếp lịch + revalidation).  
4. **Đóng D11 Gate web + UAT** (#232, #236) (PR-05/06) — UAT/security bắt buộc, không hỏi miễn.  
5. **Ops:** runbook on-call cửa sổ event (PR-14) + restore drill đã có khung RELEASE.  
6. **Device matrix** khi pilot venue / release claim (PR-09) — bắt buộc evidence; phân biệt chưa từng làm vs revalidation SHA mới.

### 5.2 Nên có ngay sau / song song (P1) — không block policy nếu pilot 1-event tối giản

- **Reconcile `#245`** (P2/P3 đã merge `main`) — đóng AC/DoD/board còn lại, không greenfield asOf  
- #246 CS email UX (O14 đã duyệt)  
- Load staging ghi số (PR-10) nếu quảng bá capacity

### 5.3 OUT / REJECT (giữ)

- Android native; payment/refund/transfer; seat; Wallet  
- Validate-only / multi-event overview / metrics product (trừ khi user mở)  
- Custom domain/sender (O07 sau MVP)  
- EAS Cloud Build  
- Tự deploy/submit từ “research xong”

### 5.4 Định nghĩa “production tối thiểu” đề xuất (recommendation)

| Nhãn | Điều kiện |
| ---- | --------- |
| **Pilot kỹ thuật (1 event demo, PII hạn chế)** | §5.1 mục 2–5 + O06 tạm O14 (không PII ngoài demo) + privacy có thể vẫn 404 **nếu** không store và không claim public legal — **nhưng** Apple store path thì privacy bắt buộc |
| **Pilot MFest / khách thật** | §5.1 đầy đủ gồm O06 số + privacy 200 + device Gate + invite HTTP |
| **Production rộng** | Pilot MFest + capacity evidence hạ tầng đích + support SLA đã công bố + (tuỳ) store available |

---

## 6. Kịch bản nghiệm thu (AC checklist — đề xuất)

### 6.1 Onboarding → publish (Owner / Manager)

| ID | Given / When / Then | Check |
| -- | ------------------- | ----- |
| AC-ON-1 | Given invite email When Owner accept qua HTTP UI Then tenant ACTIVE; lỗi CSRF/origin hiện VI | Playwright headless `/invite` trên staging/prod **ủy quyền**; cấm SQL bypass |
| AC-ON-2 | Given Admin publish event When public list/detail Then dữ liệu = server projection; không default fixture | Sau merge #255–#257; curl/BFF + web/iOS empty fail-closed |
| AC-ON-3 | Given 2 tenant When brand/config khác Then không lẫn | Regression D4 Tenant2 + brand-test |

### 6.2 Attendee

| ID | Given / When / Then | Check |
| -- | ------------------- | ----- |
| AC-AT-1 | Redeem web → email QR → cùng user iOS ví | Headless + sim; SHA trên `main` |
| AC-AT-2 | Offline mở QR đã lưu; online status có thể lệch → không giả Gate OK | Sim UAT; device nếu pilot |
| AC-AT-3 | Privacy / terms version đã đồng ý được lưu (PRD M04) | Spot-check + legal page 200 |

### 6.3 Ngày sự kiện (Scanner / Supervisor / Manager / CS)

| ID | Given / When / Then | Check |
| -- | ------------------- | ----- |
| AC-DAY-1 | Scan OK / dup / revoke / sai event — copy+a11y không chỉ màu | iOS Gate AC; web Gate #232 |
| AC-DAY-2 | Mất mạng: không success giả; queue/conflict theo ADR-18 | #232 + iOS offline evidence |
| AC-DAY-3 | Dashboard `asOf` + việc cần làm (emailNeedsCs, pending, quota) | Code: verify trên merge #250/`f0191a2…` + #260/`a456c7f…`; **acceptance:** đóng remaining AC + evidence Issue `#245` (reconcile, không re-build asOf) |
| AC-DAY-4 | CS timeline: ACCEPTED ≠ DELIVERED; resend không issue vé mới | Sau #246 + BE cs tests |

### 6.4 Hậu sự kiện / support

| ID | Given / When / Then | Check |
| -- | ------------------- | ----- |
| AC-POST-1 | Export đối soát trong quyền; link hết hạn | D4 export + MinIO policy |
| AC-POST-2 | Retention/anonymize theo O06 đã chốt | Job/runbook — sau khi user chốt số |
| AC-POST-3 | P1 incident trong cửa sổ event: kênh + owner phản hồi đúng SLA đã chọn | Tabletop runbook |

**Evidence rules:** artifact `docs/reviews/*` + exact SHA; headless mặc định; device khi Issue yêu cầu. Untracked local ≠ PASS trên `main`.

---

## 7. O06 — lựa chọn để user quyết (không tự chốt số)

Tham chiếu: [`docs/ops/O06-OPTIONS.md`](../ops/O06-OPTIONS.md).  
Nguồn thị trường (privacy store, ngày truy cập **2026-10-18**):

- Apple App Review Guidelines 5.1.1 Privacy Policies — bắt buộc link privacy trong metadata + trong app; phải nêu retention/deletion: https://developer.apple.com/app-store/review/guidelines/  
- App Store Connect — Privacy Policy URL required: https://developer.apple.com/help/app-store-connect/reference/app-privacy/  
- App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/

### 7.1 Retention (chọn một hướng / hàng)

| Hạng mục | Lựa chọn A | Lựa chọn B | Lựa chọn C |
| -------- | ---------- | ---------- | ---------- |
| Tài khoản khi user yêu cầu xóa | Anonymize ≤ N ngày | Xóa cứng ≤ N ngày | Giữ đến hết khiếu nại vé + N |
| Vé / check-in sau event | Giữ N ngày rồi anonymize | Giữ đến hết năm tài chính | Chỉ aggregate sau N ngày |
| Audit log | TTL dài hơn transactional (N₂) | Cùng TTL vé | “Không xóa trong MVP” (ghi rõ rủi ro) |
| Object store export/QR | TTL object = signed URL + job xóa | Chỉ hết hạn URL | |
| Backup vs erasure | Backup tôn trọng xóa trong RPO | Backup giữ N_backup (undelete rủi ro) | |

→ User điền **N / N₂ / N_backup** hoặc chọn “**không ingest PII ngoài demo đến khi chốt**” (status O14 hiện tại).

### 7.2 Region

| ID | Ý nghĩa |
| -- | ------- |
| **A** | Single-region VPS (Postgres + object + Keycloak cùng quốc gia) — đơn giản |
| **B** | Split DB region X / object Y — cần ADR |
| **C** | EU-only / VN-only / … — ràng buộc pháp lý |

### 7.3 SLA support

| Trục | Lựa chọn |
| ---- | -------- |
| Giờ | Business-hours thường ngày **hoặc** 24/7 trong cửa sổ event (khuyến nghị tách) |
| P1 response | User chọn phút/giờ — **không** copy RPO≤15m / RTO≤2h PRD làm SLA support |
| Kênh | Email / chat / hotline — cấm log OTP/QR/PII thô vào ticket |

### 7.4 Quy trình chốt (recommendation)

1. User chọn bảng §7.1–7.3 (hoặc giữ O14 tạm).  
2. Coordinator ghi DECISION-LOG đóng O06.  
3. Mới ingest PII thật / deploy privacy khớp số đã chọn.  
4. Architect chỉ vào nếu chọn region B hoặc cơ chế xóa/backup phức tạp.

---

## 8. Support / escalation đề xuất (ops, không code)

| Mức | Ai | Khi nào | Hành động |
| --- | -- | ------- | --------- |
| L1 CS tenant | CS | Email/vé/redeem | Timeline + resend; không đổi quota |
| L2 Supervisor | Supervisor | Gate nhầm / exception | Undo có lý do + audit |
| L3 Manager | Event Manager | Quota/publish/cửa sổ | Đổi config có audit; không SQL |
| L4 Platform | Operator + on-call | Tenant down / IdP / queue | Support grant TTL + audit; RUNBOOK |
| Sev-event | On-call P1 | Cổng chết trong cửa sổ | Theo SLA §7.3; freeze thay đổi native giữa giờ (PRD §11) |

**Non-goal:** không impersonate âm thầm; không mở validate-only trừ khi user chốt PR-12.

---

## 9. Phụ thuộc & wave gợi ý (cho coordinator / planner)

```text
Policy (user):     O06 chốt  ∥  duyệt privacy content (deploy ủy quyền)
Code path:         #255 (Chờ duyệt) → #256 ∥ #257   #254 đã mở — không xin duyệt lại
D11 đóng:          #232 → #236 (UAT bắt buộc)
Web slot (O14):    reconcile #245 (P2/P3 merged) ∥ #246 ∥ invite PR-04 (đã duyệt — xếp lịch)
Pilot gate:        device UAT + restore + runbook — bắt buộc khi claim pilot/release; không miễn
Store (optional):  privacy 200 → task submit riêng
```

**Backpressure (fact board):** 1 `Chờ duyệt` (#255); chưa đầy ngưỡng ≥3 — ưu tiên đóng #232/#236, review #255, **reconcile #245** trước phình feature mới cùng slice web.

---

## 10. Non-goals (nhắc lại)

- Không feature coding trong task này.  
- Không đổi invariant tenant / auth / quota / check-in.  
- Không EAS Cloud Build; không spawn worker con.  
- Không tuyên bố production ready từ research này.

---

## 11. Câu hỏi user cần chốt (tóm tắt điều hành)

**Không hỏi lại:** phê duyệt O15 / Epic #254; phê duyệt invite theo O14; miễn security/UAT/device gate.

1. **O06:** chọn số retention + region A/B/C + SLA cửa sổ event — hay giữ “không PII ngoài demo”?  
2. **Privacy:** ủy quyền deploy `/privacy` 200 khi nào (trước/sau O06 số liệu)?  
3. **Thứ tự slot web (đã duyệt):** invite revalidate (PR-04) vs reconcile `#245` vs `#246` vs `#232` — chỉ xếp lịch, không duyệt scope lại.  
4. **Validate-only / multi-event / metrics:** giữ OUT?  
5. **Store submit:** horizon sau privacy 200 + ASC — chốt khi nào (task ủy quyền riêng)?

**Ghi nhận (không hỏi miễn):** gate security/UAT/device trước claim pilot/release là bắt buộc; phân biệt task **chưa từng có evidence** vs **revalidation** trên SHA mới sau thay đổi hành vi.

---

## 12. Handoff

| Người nhận | Việc |
| ---------- | ---- |
| Coordinator | Đồng bộ board; ưu tiên review #255; không merge từ artifact này; giữ dirty tree |
| Epic planner D11 / #254 | Wave theo §9; không serialize giả |
| Architect | Chỉ khi region B / contract public list mới / erasure-backup |
| PD | Không bắt buộc — IA CS/Dashboard đã có hướng O14 |
| Coding workers | Chỉ sau Issue + AC từ bảng §4 được dispatch |

**Kết luận điều hành (recommendation):**  
Sau D0–D10 acceptance và D11 phần lớn code-complete trên board, **đường vào production thật** còn phụ thuộc **policy O06 + privacy live + thực thi #254 + invite HTTP (O14) + đóng Gate/UAT D11 + device/security evidence khi claim pilot** — không phải thêm Android/payment. Dashboard O12 **P2/P3 đã merge** (`f0191a2…` / `a456c7f…`); `#245` còn **reconcile AC/board**, không kết luận missing asOf từ HEAD worktree cũ. CS `#246` vẫn P1 greenfield. Evidence untracked local **chưa** thay DoD trên `main`.

---

## 13. Giới hạn phiên research

- Không phỏng vấn user thật; không chạy Simulator/DB worker khác.  
- Không verify lại từng DoD untracked trên exact merge SHA; follow-up này chỉ sửa kết luận stale asOf/#245 theo `gh pr view` + `origin/main` `report.ts`.  
- Graph/source sâu giao architect/#254 BA đã làm — file này không mở audit mới `apps/**`.  
- Ngày đối chiếu board + curl: **2026-10-18**; errata Dashboard: cùng ngày.
