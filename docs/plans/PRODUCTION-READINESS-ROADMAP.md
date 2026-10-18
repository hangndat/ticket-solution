# Production Readiness — Roadmap điều phối (Epic planner)

| Trường | Giá trị |
| ------ | ------- |
| Vai trò | Epic planner (`orca-epic-orchestrator.mdc`) — **không** role coding catalog |
| Agent | `cursor` (theo `orca-agent-routing.mdc`) |
| Ngày soạn / reconcile | 2026-10-18 |
| Orca task / dispatch | `task_2e2d64336408` / `ctx_ac1c063e393e` |
| Run | `run_127c4628d08d` (xem `PRODUCTION-READINESS-RUN.md`) |
| Ownership duy nhất | **File này** |
| Base worktree HEAD | `e8512d0055e0e9d6585007e8363b6224a7138b12` |
| `origin/main` (đối chiếu, **không** = deploy SHA) | `2416a94b02acb50a5186309aa619c04fec106317` |
| Board | [Project #3](https://github.com/users/hangndat/projects/3) |

**Ủy quyền đợt này:** nghiên cứu local + đề xuất. **Chưa** authorize deploy production, store submit, cloud resource, commit/push/PR/merge, hay cập nhật GitHub từ worker này. **Không sửa** `docs/ROADMAP.md`.

**Verdict điều phối (recommendation):** **Chưa pilot ready · chưa production ready.** Nhiều Issue D0–D10 (+ nhiều slice D11) **acceptance complete** trên board; còn gap policy/ops/security/public-SoT. Mục tiêu user = hướng production — **không** đồng nghĩa đã được phép deploy.

---

## 0. Evidence & phân loại

| Loại | Nghĩa |
| ---- | ----- |
| **Fact** | Board/`gh`/source/HTTP/path+SHA tại thời điểm viết |
| **Inference** | Kết luận từ fact + PRD/TD/DECISION |
| **Recommendation** | Việc coordinator/user nên làm tiếp |

### 0.1 Git / dirty tree (fact)

| Mục | Giá trị |
| --- | ------- |
| HEAD | `e8512d0…` — merge-base với `origin/main` = HEAD → **main đã tiến trước** worktree tip |
| Dirty | Nhiều `docs/**`, rules, `AGENTS.md`, `apps/mobile/**` modified/untracked — **giữ nguyên**; không suy đã merge |
| Report đợt này | Chỉ sửa file ownership này |

### 0.2 Bốn mức hoàn thành

| Mức | Hiện trạng (inference có kiểm soát) |
| --- | ----------------------------------- |
| **Code complete** | Phần lớn MVP mở rộng + nhiều D11 slice trên `main`; #254 BE còn Chờ duyệt |
| **Acceptance complete** | Nhiều Epic/Issue **Hoàn thành** trên Project #3; parent D11/#254 chưa đóng |
| **Pilot ready** | **Chưa** — O06 mở, privacy 404, SMTP/restore/load **U**, #254/#232/#236 còn mở; Gate Origin = P1 hardening |
| **Production ready** | **Không** — thiếu ủy quyền deploy + gate §6 |

### 0.3 Report chuyên môn (reconcile 2026-10-18)

| Report | Path | Dispatch | Trạng thái |
| ------ | ---- | -------- | ---------- |
| BA | `PRODUCTION-READINESS-BA.md` | `ctx_bdc9363309a2` | **Có** — đã đọc |
| UX | `PRODUCTION-READINESS-UX.md` | `ctx_72fbe28af246` | **Có** — đã đọc |
| Architecture | `PRODUCTION-READINESS-ARCHITECTURE.md` | `ctx_566d14427627` | **Có** — đã đọc |
| Security | `PRODUCTION-READINESS-SECURITY.md` | `ctx_03891bf41549` | **Có** — đã đọc |
| Run frame | `PRODUCTION-READINESS-RUN.md` | coordinator | **Có** |

---

## 1. Phạm vi: đã approved vs nghiên cứu mới

### 1.1 Đã approved / đang chạy — **không** xin duyệt lại

| Phạm vi | Authority | Ghi chú |
| ------- | --------- | ------- |
| D11 UX coding (#222) | User duyệt 18/10; O11 | Gate/attendee/admin surfaces trong gói; OUT validate-only/metrics/O06 số/privacy deploy/store |
| O14 residual | DECISION-LOG O14 | Dashboard O12 + CS UX + reject-audit; invite **sau** attendee (đã xong #234) — **đã authorize**, không hỏi lại |
| Epic #254 / ADR-19 / O15 | Issue #254 + architect | Published event SoT server — **đã chốt hướng**; triển khai #255→#256∥#257 |

### 1.2 Phạm vi mới (research → user review trước coding/ops mới)

Policy O06 · privacy publish (khi ủy quyền) · SMTP/backup/load/admission/on-call · Gate Origin hardening (P1) · device reval · supply-chain CI · staging tách. **OUT cứng:** O10 hủy; EAS Cloud; tự deploy.

---

## 2. Project #3 snapshot (fact, 2026-10-18)

`gh project item-list 3 --owner hangndat --limit 300` → 126 item: **114** Hoàn thành · **5** Đang làm · **3** Sẵn sàng · **1** Chờ duyệt · **2** Bị chặn · **1** Chưa lên lịch (#7).

| Status | # | Title |
| ------ | - | ----- |
| Đang làm | 222 / 230 / 232 / 236 / 254 | D11 Epic · Gate story · Web Gate offline · UAT · Event server source |
| Sẵn sàng | 233 / 245 / 246 | Attendee story parent · Dashboard O12 · CS email UX |
| Chờ duyệt | 255 | BE public published (+ PR #261 mở) |
| Bị chặn | 256 / 257 | Web/iOS published-first (chờ #255) |

WIP duyệt: Chờ duyệt = 1 → **chưa đầy**. Ưu tiên đóng #255 + D11 active trước feature production-path mới.

### 2.1 Drift Status #245 (fact + inference)

| Quan sát | Chi tiết |
| -------- | -------- |
| Board | #245 vẫn **Sẵn sàng** / Issue OPEN |
| Code trên `origin/main` | `interpretEventReport`, `asOf`, `emailNeedsCsCount`, deep-link KPI trong `admin-form.tsx` / `report.ts` |
| Merge evidence | PR **#250** (Wave P2, Issue #249) merge `f0191a2a…`; PR **#260** (Wave P3, Issue #258) merge `a456c7fb…` |
| DoD local | `D11-PR-250-*-REVAL3.md` **PASS**; `D11-PR-260-*-DOD.md` **PASS** (untracked — không suy = board Hoàn thành) |

**Inference / recommendation:** Đây là **status drift / parent Issue chưa đóng**, **không** phải “consumer chưa code”. Coordinator nên: (1) đối chiếu AC còn lại của #245 vs P2+P3 đã merge; (2) nếu AC đủ → chuyển board + đóng; (3) nếu còn UAT tích hợp → gắn vào #236, không spawn impl trùng. **Không** xếp #245 như P0 coding mới.

---

## 3. Top 15 gap hợp nhất (BA ∩ UX ∩ Arch ∩ Sec)

> Chỉ 15 mục tác động cao. Chi tiết đầy đủ nằm ở 4 report. Runtime nhiều mục = **chưa xác minh** — không claim PASS.

| ID | Gap | Evidence | Rủi ro | P | AC / check | Owner (role) | Dep thật | User chốt? |
| -- | --- | -------- | ------ | - | ---------- | ------------ | --------- | ---------- |
| PR-01 | **O06** retention/region/SLA chưa số | DECISION-LOG; `O06-OPTIONS.md`; BA §7; Sec S01 | Chặn **ingest PII thật** / DPA — **không** chặn coding D11/#254 độc lập | **P0 policy** | Đóng O06 trong DECISION-LOG (hoặc giữ O14 tạm tường minh) | User + ops → coordinator docs | — | **Có** — chọn gói §7 |
| PR-02 | Privacy URL **404** | Curl BA/Sec 2026-10-18; UX-03; không `app/privacy` | Store/trust | **P0** | `GET /privacy` 200 + copy đã duyệt (không bịa retention) | `web` + deploy **ủy quyền** | Soft: nội dung legal | **Có** — nội dung + ủy quyền publish |
| PR-03 | Public event vẫn **fixture SoT** | #254; #255 Chờ duyệt; #256/#257 Bị chặn; Arch G04; UX-01 | Demo ≠ production content | **P0** | Published list/detail SoT; empty/error fail-closed; không fallback fixture | `backend` → `web`∥`ios` | Hard: #255 merge+DoD(+security) | Không (O15/#254 đã chốt) |
| PR-04 | RLS + MFA **release-verify** | Arch G18/G17; Sec MFA gate đã approved | Tenant leak / thiếu step-up | **P0** | `database-isolation` + Keycloak assurance trên SHA phát hành | `backend` + ops + reviewers | CI / realm | Không miễn; không hỏi lại MFA policy |
| PR-05 | Web Gate offline #232 | Board Đang làm; UX-05; BA PR-05 | Success giả khi mất mạng | **P0** (D11) | AC-G4 + headless offline | `web` | — | Không (đã trong D11) |
| PR-06 | UAT tích hợp D11 #236 | Board Đang làm | Epic #222 chưa acceptance | **P0** | Headless web+sim + local iOS build + exact SHA | coordinator | Surfaces IN | Không |
| PR-07 | SMTP outbound Internet **chưa xác minh** | Arch G03 final: README/Mailpit = **tài liệu lịch sử**; config VPS hiện tại **U** — **không** khẳng định đang Mailpit | Email invite/ticket có thể không deliver | **P0 ops** | (1) Xác minh observed SMTP (ops) (2) Outbound smoke (3) SPF/DKIM nếu gửi `vemoki.com` | ops + `backend` | DNS | **Có** — Postal/Postfix **nếu** chưa có MTA |
| PR-08 | Backup/restore **hạ tầng phát hành** | Arch G02; D5 local `productionClaim: false` | Mất data; RPO/RTO không chứng minh | **P0 ops** | Drill restore staging/VPS đồng hình + RPO/RTO đo được | ops / coordinator | Staging mirror | **Có** — PITR vs dump (vẫn phải drill đích) |
| PR-09 | Load evidence khớp tải phát hành | Arch G05; D5 Mac harness ≠ VPS | Overcommit capacity | **P0 ops** | `d5-load-baseline` (hoặc tương đương) trên env phát hành; ghi hardware | ops + `backend` | Staging | **Có** — gate cứng? không thay evidence |
| PR-10 | Invite Owner HTTP (D4 CSRF lịch sử) | `D4-TENANT2-PROD-UAT`; BA PR-04 errata; O14 đã duyệt | Onboard Owner gãy | **P0**/slot | Accept HTTP + copy VI; **revalidation** trước release | `web` (± security) | Soft: slot vs #232/#246 | Không xin authorize lại — **lịch + reval** |
| PR-11 | Gate BFF thiếu Origin/CSRF guard | Sec **final** @ `origin/main` `2416a94…`: fact thiếu guard; SameSite=Lax + JSON → CSRF form cổ điển **chưa chứng minh** | Potential CSRF / lệch defense-in-depth vs redeem | **P1** hardening | Test giả định cookie cross-site; Origin guard khuyến nghị — **không** confirmed exploit P0 | `web` | — | Không |
| PR-12 | CS email UX #246 | Board Sẵn sàng; O14; UX-06 | Nhầm ACCEPTED=đã nhận | **P1** | Timeline + DELIVERED≠ACCEPTED | `web` | BE CS sẵn | Không (O14) |
| PR-13 | Dashboard #245 reconcile | BA errata; §2.1; merge #250/#260 | Board/AC ≠ code | **P1 board** | Đóng remaining AC + Project khi đủ; **không** re-code asOf | coordinator ± `reviewer-dod` | — | Không |
| PR-14 | MinIO / APNs / admission — **reval** | Arch G07/G08/G06; D4/D5 lịch sử | Export/push/opening-shock | **P1** | Re-verify live (không claim README); admission nếu event lớn | ops | — | Confirm buckets / APNs gateway? |
| PR-15 | On-call / metrics scrape | Arch G10 | Mù sự cố cửa sổ Gate | **P1** | Alert→on-call; RUNBOOK sign-off | ops | — | **Có** — ai on-call? |

\*Device/camera: Arch xếp **revalidation trước release** (D5 board Done) — không mở lại như “chưa từng làm” nếu thiếu evidence ngược; vẫn **chưa xác minh** đủ ma trận venue trong research này.

**Bổ sung P0 release-verify (Arch final — không miễn):** **G18 RLS** (`database-isolation` + NOBYPASSRLS smoke trên SHA phát hành) · **G17 MFA/Keycloak assurance** (smoke realm phát hành; mobile ≠ `ticket-platform-api`). Đây là gate bắt buộc, không P2 tùy chọn.

### 3.1 Cổng bắt buộc trước user thật / pilot data

**Confirmed P0 (Sec final):** **PR-01 O06** · **PR-02 privacy 404**.  
**P0 release-verify (Arch, không miễn):** **G17 MFA** · **G18 RLS** · **PR-08 restore** · **PR-09 load** · **PR-07 SMTP outbound observed+smoke** · DoD+security #255.  
**P1 hardening (không blocker P0):** **PR-11** Gate Origin guard + test assumptions. MFA IdP = chứng minh runtime đã approved — không hỏi lại user.

### 3.2 Known gap lịch sử vs chưa verify deployment (Arch final)

| Chủ đề | Evidence lịch sử | Cách đọc đúng |
| ------ | ---------------- | ------------- |
| SMTP / Mailpit | deploy README; R-INT Unknown | **Tài liệu lịch sử** — config VPS **U**; xác minh observed rồi mới smoke |
| MinIO misconfig | D4 UAT known gap | **Revalidation** — không claim live từ README |
| APNs sandbox DELIVERED | D5 tracked PASS sandbox | Prod gateway **U** — reval trước release |
| Overlay metrics | Scripts local PASS | Scrape/alert prod **U** |

### 3.3 P2 / OUT (giữ ngoài production tối thiểu)

Validate-only / multi-event overview / metrics product (trừ user mở) · O07 custom domain · Android/payment/seat/Wallet · store submit (ủy quyền riêng) · O13 cutover ngày (theo dõi, không block tối thiểu trừ GTM).

---

## 4. Epic → Story → Task đề xuất (chưa tạo Issue)

```text
Epic PR — Production readiness (đề xuất; chưa approve coding/deploy)
├── S0 Research ✓ — BA∥UX∥Arch∥Sec∥Planner (file này)
├── S1 Close approved delivery — D11 còn lại ∥ #254 (#255→#256∥#257) ∥ board sync #245
├── S2 Policy & legal — O06 + privacy (user gates)
├── S3 Security verify — RLS/MFA release smoke (P0) · Gate Origin hardening (P1)
├── S4 Ops P0 — SMTP outbound verify · backup/restore đích · (∥) MinIO reval
├── S5 Reliability — load-on-target (P0) · admission/on-call (P1)
├── S6 Device / store prep — device matrix · ASC prep ≠ submit
├── S7 Slot web residual — invite HTTP · #246 CS (theo WIP 1 slot)
└── S8 Release go/no-go — checklist + **ủy quyền deploy riêng**
```

### 4.1 Task skeleton (Role ID + path)

| Story | Task | Role ID | Path role | Scope | Architecture impact |
| ----- | ---- | ------- | --------- | ----- | ------------------- |
| S1 | Đóng #232 AC-G4 | `web` | `docs/agents/roles/web.md` | Gate offline | Không |
| S1 | #236 UAT milestone | coordinator | — | Headless + iOS local build evidence | Không |
| S1 | #255 DoD+security | `reviewer-dod` ± `reviewer-security` | roles tương ứng | Exact SHA PR #261 | Có (public surface) |
| S1 | #256 / #257 | `web` / `ios` | … | Published-first | Consume contract |
| S1 | Sync #245 board | coordinator | — | Đóng hoặc gắn residual #236 | Không |
| S2 | Chốt O06 | user → docs | — | DECISION-LOG | Không |
| S2 | Privacy publish | `web` + deploy ủy quyền | `web.md` | `/privacy` 200 | Không |
| S3 | Gate BFF Origin hardening | `web` | `web.md` | Origin guard + test assumptions (P1) | Không |
| S3 | RLS isolation release | `backend` + reviewers | `backend.md` / `reviewer-security.md` | G18 trên SHA phát hành | Không |
| S4 | SMTP verify (+ ADR nếu thiếu MTA) | ops ± `architect` | `architect.md` | Observed config + smoke | **Có** nếu đổi MTA |
| S4 | Backup/restore drill đích | ops ± `architect` | `architect.md` | Staging/VPS đồng hình | **Có** |
| S5 | Load-on-target | ops + `backend` | `backend.md` | Env phát hành | Có nếu topology đổi |
| S5 | On-call + admission | ops | — | RUNBOOK + edge nếu cần | Không |
| S6 | Device matrix | `ios` | `ios.md` | Local signed | Không |
| S7 | Invite / #246 | `web` | `web.md` | Theo O14 lịch | Không |
| S8 | Go/no-go | coordinator + user | — | §6 | — |

### 4.2 Wave bề rộng tối đa

```text
Now (đã ủy quyền — idle-fill, không chờ research):
  web[#232 hoặc #246 theo 1 slot]  ∥  ios[D11 residual]  ∥  reviewer(#255)
  ∥  (sau merge #255) web[#256] ∥ ios[#257]

Song song policy/ops (không tranh apps path):
  user O06  ∥  docs ADR SMTP/backup (architect)  ∥  board sync #245

Sau user duyệt roadmap §7 (S3–S5):
  web[Gate Origin P1]  ∥  ops[SMTP verify|backup|load]  ∥  RLS/MFA smoke  ∥  không deploy trừ ủy quyền

Cấm:
  ❌ Spawn impl #245 trùng P2/P3 đã merge
  ❌ Deploy / store / EAS Cloud
  ❌ Hạ S03/RLS/MFA xuống P2 tùy chọn
  ❌ Serialize giả toàn bộ Stories khi Task đã unblocked
```

---

## 5. Gate release go / no-go

### 5.1 Pilot ready (khuyến nghị)

| # | Gate | Trạng thái lúc reconcile |
| - | ---- | ------------------------ |
| G1 | O06 chốt **hoặc** “chỉ demo PII” tường minh (O14) | O06 **mở** — no-go PII thật |
| G2 | Privacy 200 nếu store/public legal path | **404** (đo 2026-10-18) |
| G3 | RLS + MFA release-verify (Arch G18/G17) | **Chưa chạy** trên SHA phát hành trong wave này — **không miễn** |
| G4 | Gate BFF Origin/CSRF | Sec final: **P1** potential — không no-go P0 khi chưa PoC; vẫn nên hardening |
| G5 | #254 published SoT (#255–#257) nếu public/home là surface pilot | #255 Chờ duyệt |
| G6 | #232 + #236 D11 | Đang làm |
| G7 | SMTP outbound observed + smoke **hoặc** no-email tường minh | Config hiện tại **U** |
| G8 | Backup/restore + load trên hạ tầng phát hành | Local Mac ≠ claim |
| G9 | Device/APNs/MinIO reval nếu venue/TF | D5 Done → reval, không “chưa từng làm” |
| G10 | Không EAS Cloud; team `BLUA62D52G` | Policy fact |

### 5.2 Production ready (thêm)

Ủy quyền **deploy** tường minh · health/OIDC sau deploy · admission nếu bật · on-call + rollback freeze · không claim capacity vượt benchmark đích · supply-chain gate (Sec S11) · MFA IdP chứng minh.

**Verdict:** Research complete cho ownership file này. **Deploy chưa được authorize.**

---

## 6. Evidence cần bổ sung

| Evidence | Owner | Ghi chú |
| -------- | ----- | ------- |
| Exact-SHA DoD+security #255 / PR #261 | reviewers | Trước #256/#257 |
| Board quyết định #245 | coordinator | Drift vs `main` |
| Staging restore + backup job | ops | Cần ủy quyền MT |
| Gate Origin hardening + test assumptions | `web` | P1 sau Sec final |
| SMTP/APNs/MinIO **re-verify** trên VPS (không đọc secret vào git) | ops | Phân biệt known gap vs live |
| Device UAT log | `ios` | Local signed |
| O06 closed entry | user → coordinator | Trước PII thật |
| CI `database-isolation` trên SHA release | coordinator | Gate bắt buộc |

---

## 7. Quyết định user cần chốt (chỉ policy / phạm vi mới)

> Không hỏi lại: #254/O15, O14 invite/Dashboard/CS đã authorize, quyền discovery đợt này.

| # | Quyết định | Khuyến nghị planner |
| - | ---------- | ------------------- |
| Q1 | **O06** — gói A demo-only / B chốt số / C hoãn prod data (xem BA §7 + Sec §5) | A hoặc C ngay; B trước PII/privacy số |
| Q2 | Ủy quyền **publish `/privacy`** khi nội dung sẵn sàng? | Có cho store/public trust |
| Q3 | SMTP: xác minh observed trước — nếu chưa MTA thì Postal vs Postfix vs trì hoãn? | Không giả định Mailpit live |
| Q4 | Backup: PITR vs dump — **vẫn** bắt buộc drill trên hạ tầng phát hành | Không thay bằng harness Mac |
| Q5 | **APNs** sandbox đủ pilot hay bắt buộc prod gateway + TF? | Prod gateway nếu TF public testers |
| Q6 | Load-on-target: chấp nhận pilot nhỏ ghi hạn chế hay gate cứng trước mở vé công chúng? | Không quảng cáo ngoài số đo |
| Q7 | Ai **on-call Gate** / kênh P1 cửa sổ event? | Bắt buộc ghi RUNBOOK |
| Q8 | Mở Epic board “Production readiness” (D12?) tách D11/#254? | Có — tránh trộn Status |
| Q9 | **Ủy quyền deploy production** khi nào? | Chỉ sau §5.1; **chưa** hôm nay |
| Q10 | Store submit? | Tách task; prep ≠ submit |

Optional ngoài tối thiểu (không bắt buộc hỏi ngay): validate-only, multi-event, metrics, O13 cutover ngày.

---

## 8. Việc coordinator làm tiếp

1. Idle-fill D11/#254; reviewer #255; **không** spawn coding trùng #245 P2/P3.
2. Sync board #245 (đóng hoặc gắn residual #236).
3. Đưa package (4 report + file này) cho **user review §7**.
4. Sau duyệt: tạo Issue S3–S5 theo ownership; `worker-start --agent cursor` + Role ID.
5. **Không** deploy/store; **không** sửa `ROADMAP.md` từ research worker.

---

## 9. Nhật ký reconcile

| Thời điểm | Sự kiện |
| --------- | ------- |
| 2026-10-18 | Skeleton từ Project + artifact D11/MVP/#254 |
| 2026-10-18 | Reconcile BA+UX+Arch+Sec v1; drift #245; top 15 |
| 2026-10-18 | BA errata #245; Arch final SMTP **U** + G17/G18/G02/G05 P0 |
| 2026-10-18 | Sec final: S03 → P1 potential (Lax+JSON); confirmed P0 = O06+privacy; roadmap chốt |

---

## 10. Kết luận điều phối (3 câu)

Đã reconcile đủ 4 report (kể BA errata, Arch final, Sec reval). Hệ thống **chưa pilot/production ready**: confirmed P0 = O06 + privacy; thêm P0 release-verify RLS/MFA/restore/load/SMTP outbound **U** + đóng #254/#232/#236; #245 = reconcile board (P2/P3 đã merge); Gate CSRF = P1 hardening không confirmed exploit. Còn lại: user chốt §7, coordinator sync board + idle-fill — **deploy chưa authorize**.
