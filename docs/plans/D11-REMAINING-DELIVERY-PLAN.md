# D11 — Kế hoạch hoàn tất phần việc còn lại

> Đây là snapshot lập kế hoạch lúc giao việc; trạng thái thay đổi sau đó xem [Run tiếp tục](./D11-REMAINING-RUN.md) và Project #3. Không dùng bảng snapshot này để suy trạng thái hiện tại.

| Trường | Giá trị |
| --- | --- |
| Epic D11 | [#222](https://github.com/hangndat/ticket-solution/issues/222) |
| Epic song song (ADR-19) | [#254](https://github.com/hangndat/ticket-solution/issues/254) |
| Authority | O11 (D11 UX) · O14 (CS + invite sau attendee) · O15/ADR-19 (event server) |
| Snapshot board | Project #3 · 2026-10-18 (live `gh project item-list`) |
| Planner HEAD (workspace) | `e8512d0055e0e9d6585007e8363b6224a7138b12` (docs tracker; **không** = tip feature PR) |
| Architecture impact | **Không** — tổng hợp delivery; không đổi ADR/contract |
| Agent | `--agent cursor` · **không** worker con · **không** mutate board/Issue/PR từ planner |
| File chỉnh | **chỉ** file này (local) |

**Phân biệt:** code complete ≠ acceptance complete ≠ pilot ready. Research mới (`PRODUCTION-READINESS-*`, dashboard residual ngoài O14) **không** mở feature mới trước user review.

**Graph limitation:** `code-review-graph-ticket` stale (`built_at_sha` ≠ HEAD) → 0 hit CS/invite; planner dựa board/PR/docs/source paths đã biết, không sửa code.

---

## 1. Live board (đối chiếu Issues yêu cầu)

| Issue | Status Project | GitHub | Vai trò delivery | Ghi chú |
| --- | --- | --- | --- | --- |
| #222 | Đang làm | OPEN | Epic D11 parent | Đóng sau #230/#233/#236 + evidence |
| #230 | Đang làm | OPEN | Story Gate | #231 Hoàn thành; #232 Chờ duyệt |
| #232 | Chờ duyệt | OPEN | Web Gate AC-G4 | PR [#263](https://github.com/hangndat/ticket-solution/pull/263) tip `30f88b3ad4373aa859cd193babad13b034829c28` · DoD+security **PASS** (artifact trên branch DoD) · CI tip xanh · **run_124** đang reval — **không giao trùng** |
| #233 | Sẵn sàng | OPEN | Story attendee | #234/#235 **CLOSED** (code+DoD đã merge) — Story chờ parent/milestone index, **không** coding mới |
| #236 | Đang làm | OPEN | Milestone UAT/evidence | **Không** worker active (coordinator xác nhận) — chuẩn bị evidence index độc lập |
| #246 | Sẵn sàng | OPEN | Web CS UX (O14) | Ready **sau** backpressure web; BE CS API sẵn |
| #254 | Đang làm | OPEN | Epic ADR-19 | #255 Hoàn thành; consumers đang review |
| #255 | Hoàn thành | CLOSED | BE public events | Merge `b099ce43…` + CI shard [#265](https://github.com/hangndat/ticket-solution/pull/265) `cfabced` |
| #256 | Chờ duyệt | OPEN | Web published consumer | PR [#268](https://github.com/hangndat/ticket-solution/pull/268) tip `2d2de458…` · **CI web/ci FAIL** — fix thuộc **run_86** · **không giao trùng** |
| #257 | Chờ duyệt | OPEN | iOS published-first | PR [#267](https://github.com/hangndat/ticket-solution/pull/267) tip `1506daaaf79d0b6d077620de5e00d44c24ce8773` · CI mobile+ci SUCCESS · PR [#266](https://github.com/hangndat/ticket-solution/pull/266) **CLOSED** supersede — **run_86** · **không giao trùng** |

### WIP / backpressure (quan sát)

- `Chờ duyệt` = **3** (#232, #256, #257) → **đạt ngưỡng** ≥3 → ưu tiên review/fix/merge trước feature `web` mới (#246 / invite).
- Open PR cùng slice `web`: #263, #268 (+ infra #252/#253 ngoài đợt) → không spawn thêm feature web cho đến khi queue dưới cap.

### Active runs — cấm trùng

| Run | Scope | Planner action |
| --- | --- | --- |
| `run_86f42281f748` | #256 web + #257 ios (#254 consumers) | Không spawn coding/review trùng 256/257/268/267 |
| `run_1246840dce98` | DoD reval #263 + backend CI | Không spawn review #263 / backend CI trùng |

---

## 2. Ma trận code complete vs acceptance

| Slice | Code on `main`? | Acceptance / DoD | Còn thiếu |
| --- | --- | --- | --- |
| Web admin #229 | Có (PR #238) | Task CLOSED | Real-API brand UAT residual (known gap DoD) — **không** chặn #246 |
| iOS Gate #231 | Có (PR #240) | Task CLOSED | Device/camera = pilot gate, không milestone UI |
| Web attendee #234 | Có (PR #243) | Task CLOSED | Live IdP redeem known gap |
| iOS attendee #235 | Có (PR #248) | Task CLOSED | Brand residual đã xử lý theo merge; device = pilot |
| EventReport BE #241 + reject #244 | Có | CLOSED | — |
| Dashboard O12 #245/#258 | Có (PR #250/#260) | CLOSED | Residual CS → **#246** |
| Web Gate #232 | **Chưa merge** | DoD PASS tip `30f88b3…` · reval run_124 | Merge + Project Hoàn thành → mở đóng #230 |
| ADR-19 BE #255 | Có | CLOSED | — |
| ADR-19 web #256 | PR mở · CI đỏ | Chưa acceptance | Fix CI + DoD exact SHA (run_86) |
| ADR-19 iOS #257 | PR #267 CI xanh | Chờ DoD (run_86) | Merge sau DoD |
| CS #246 | **Chưa code đợt này** | — | Feature khi WIP web dưới cap |
| Invite HTTP (O14 #5) | Path tồn tại; **gap D4 CSRF** | Chưa Issue board | Coordinator **tạo Issue** rồi dispatch |
| Milestone #236 | — | Chưa index evidence | Spec bên dưới — headless UAT + local iOS build index |

Stories #228 admin = Hoàn thành. #233/#230/#222/#254 = parent còn mở.

---

## 3. Ready queue — wave bề rộng tối đa

### Wave A — ngay (integration / evidence; không feature web mới)

| # | Task | Role | Deps thật | Ai chạy | Độc lập ngay? |
| --- | --- | --- | --- | --- | --- |
| A1 | Settle DoD reval #232/PR #263 → merge khi PASS + CI tip xanh | coordinator (+ run_124 reviewer) | Tip `30f88b3…` không đổi hành vi sau reval | **run_124** / coordinator | Có — **không spawn trùng reviewer** |
| A2 | Fix CI #256/PR #268 → DoD exact tip mới | `web` (đang) + `reviewer-dod` sau CI xanh | CI đỏ hiện tại | **run_86** | Có trong run_86 — planner không dispatch |
| A3 | DoD #257/PR #267 tip `1506daaa…` → merge | `reviewer-dod` (± security nhẹ consumer) | CI xanh sẵn | **run_86** | Có trong run_86 |
| A4 | Đóng PR #266 nếu còn mở (đã CLOSED) / comment supersede | coordinator | — | coordinator | Có |
| A5 | **#236** chuẩn bị evidence index + headless UAT + local iOS build (Spec T-MILESTONE) | coordinator / ownership helpers | Soft: surfaces đã merge trên `main`; hard: không claim Epic đóng trước A1–A3 merge đủ scope | **Có thể độc lập ngay** (thu thập trên `main` + checklist; không chờ #246) | **Có** |
| A6 | Sau merge #232+#231: Project #230 → Hoàn thành (nếu AC Story đủ) | coordinator | A1 merged | coordinator | Sau A1 |

### Wave B — khi `Chờ duyệt` web/iOS dưới cap **và** ≤1 feature Dispatch `web`

Thứ tự O14: Dashboard (xong) → **CS #246** → **invite revalidate**.

| # | Task | Role | Deps thật | Độc lập? |
| --- | --- | --- | --- | --- |
| B1 | **#246** CS / email recovery UX | `web` · `docs/agents/roles/web.md` | Soft: BE `cs.ts` sẵn; **hard WIP:** không ∥ feature web khác; backpressure <3 Chờ duyệt hoặc không thêm Chờ duyệt web | Sẵn sàng board — **dispatch khi A2 không chiếm slot web** (sau merge/settle #268 hoặc slot free nếu coordinator tách review-only) |
| B2 | Invite Owner HTTP revalidate (O14 #5) | `web` · spec `D11-B2-web-invite` cập nhật bên dưới | **Hard:** #234 đã xong ✓ · **Hard:** Issue GitHub do coordinator tạo · **Serial `web` sau B1** (O14 wave) · Soft: không invent API | Sau B1 (hoặc song song **chỉ** nếu B1 chưa chiếm — O14 ưu tiên serial sau CS) |
| B3 | Reviewer DoD (± security) cho B1/B2 khi PR Chờ duyệt | `reviewer-dod` · `reviewer-security` (invite token/CSRF) | Tip SHA | Sau PR |

### Wave C — parent close gates (không coding)

| Parent | Điều kiện đóng / Hoàn thành | Không được |
| --- | --- | --- |
| #230 | #231+#232 Hoàn thành + CI trên merge SHA | Claim pilot Gate device |
| #233 | #234+#235 đã CLOSED; optional note brand residual trong #236 index | Mở feature attendee mới |
| #254 | #255+#256+#257 Hoàn thành + CI integrated | Fixture fallback lại |
| #236 | Evidence headless web+iOS + local iOS build + exact-SHA index (§4) | Deploy/store; pilot ready |
| #222 | #230+#233+#236 (+ O14 #246 nếu gộp đợt) đủ DoD | Mở validate-only/metrics/O06 số/privacy deploy |

### Ngoài wave (không mở)

- Validate-only / multi-event / metrics / O06 số / privacy deploy / store / EAS Cloud
- Production-readiness research docs → **chờ user review**, không Issue feature mới
- O13 sales page — Epic/GTM riêng, không nhét D11 remaining

---

## 4. Task Specs (copy vào `worker-start`)

### T-246 — Web CS / email recovery UX

```markdown
## Task
Issue #246 — [D11] Web: CS / email recovery UX (timeline + DELIVERED≠ACCEPTED)
Parent: Epic #222 · O14 #3

## Vai trò chuyên môn
- Role ID: web
- File: docs/agents/roles/web.md
- Agent: cursor
- Architecture impact: Không — consumer BE CS API đã có; không đổi contract trừ escalate

## Ownership
apps/web only — admin CS surfaces (list/detail/timeline/resend copy). Không apps/api, không mobile.

## IN
- Timeline dễ đọc; copy delivery: PENDING / FAILED / DEAD / ACCEPTED ≠ DELIVERED rõ VI
- Resend cooldown + idempotent UX (không force-admit)
- Deep-link từ Dashboard KPI “emailNeedsCs” nếu đã có (O12) — không resend từ thẻ KPI
- Headless UAT Playwright trên tip; artifacts apps/web/.uat-artifacts/d11-246-cs/
- reviewer-dod exact SHA (± reviewer-security nếu đụng support-grant)

## OUT
Force-admit; đổi OpenAPI; metrics mới; invite; deploy/store

## AC
1. Given ticket CS When mở detail Then timeline + delivery state VI khớp BE fields (không đồng nghĩa DELIVERED=user nhận)
2. Given resend When cooldown/idempotent Then UI không double-submit; lỗi VI
3. scripts/web-uat.sh (hoặc node UAT) exit 0 trên exact tip + screenshot
4. Không mở OUT O14

## Checks
- pnpm --filter @ticket/web typecheck && lint && test (scoped)
- Headless UAT CS routes; ghi port/stack Task-specific
- Artifact docs/reviews/D11-PR-<n>-WEB-CS-DOD.md

## Deps
- Soft: BE cs.ts list/get/resend sẵn
- Hard: không song song feature web khác; đợi backpressure Project
```

### T-INVITE — Owner invite HTTP revalidate (O14)

> **Chưa có Issue Project** — coordinator tạo Issue (đề xuất title: `[D11/O14] Web: Invite Owner HTTP revalidate (CSRF + copy VI)`), rồi gắn ID vào Spec. Spec file gốc: `docs/tasks/d11/D11-B2-web-invite.md` (cập nhật authority: O14 đã duyệt; không còn “CHƯA APPROVED”).

```markdown
## Task
Invite Owner HTTP revalidate — O14 quyết định #5 · sau #234 (đã xong) · sau/serial #246 theo wave O14
Parent đề xuất: #222 (hoặc link #254 không — không ADR-19)

## Vai trò chuyên môn
- Role ID: web
- File: docs/agents/roles/web.md
- Agent: cursor
- Architecture impact: Không — revalidate path hiện có; escalate nếu thiếu field CSRF/BFF

## Ownership
apps/web — /invite + BFF accept only

## IN
- Accept qua HTTP UI thành công trên stack local/staging được phép (không SQL bypass)
- Copy lỗi VI cho CSRF/origin mismatch (đóng gap D4-TENANT2-PROD-UAT)
- Headless UAT /invite; artifacts apps/web/.uat-artifacts/d11-invite/
- reviewer-dod + reviewer-security (invite token / CSRF)

## OUT
Invent invite API/schema; iOS; deploy bắt buộc; store

## AC
1. Given invite token hợp lệ When accept HTTP Then membership/tenant ACTIVE theo BE hiện hành
2. Given CSRF/origin sai When accept Then lỗi VI rõ; không silent success
3. Không dùng DB accept_membership_invite trong UAT PASS
4. Exact-SHA DoD + CI web xanh

## Checks
- web typecheck/lint/test scoped; scripts/web-uat.sh invite
- docs/reviews/D11-PR-<n>-WEB-INVITE-DOD.md

## Deps
- Hard: GitHub Issue do coordinator tạo; slot web free; khuyến nghị sau merge #246
- Soft: docs/reviews/D4-TENANT2-PROD-UAT.md làm baseline gap
```

### T-236 — Milestone evidence / headless UAT + local iOS build index

```markdown
## Task
Issue #236 — [D11-S5] Bằng chứng UAT và nghiệm thu UX/UI tích hợp
Parent: #222

## Vai trò chuyên môn
- Role: coordinator (orchestrate) + helpers ownership khi cần chạy script
- Reviewer đóng: reviewer-dod trên SHA tích hợp (docs/agents/roles/reviewer-dod.md)
- Agent: cursor
- Architecture impact: Không — chỉ evidence

## Ownership
docs/reviews/* evidence index; chạy scripts headless; không feature product mới

## IN — Evidence index (một artifact)
Tạo docs/reviews/D11-MILESTONE-EVIDENCE.md (hoặc tương đương) liệt kê:

| Surface | Merge SHA (exact) | DoD artifact | Headless UAT cmd + path | Local iOS build |
| --- | --- | --- | --- | --- |
| Web admin #229 | <sha> | D11-WEB-ADMIN-DOD | … | n/a |
| iOS Gate #231 | <sha> | … | sim-uat | prebuild+xcodebuild Team BLUA62D52G |
| Web attendee #234 | <sha> | … | … | n/a |
| iOS attendee #235 | <sha> | … | … | … |
| Web Gate #232 | <sha sau merge> | D11-PR-263-… | /gate | n/a |
| ADR-19 web/iOS #256/#257 | <sha> | … | … | iOS binary |
| O14 CS/invite | nếu gộp đợt | … | … | n/a |

Gates bắt buộc (github-project-tracking Milestone DoD):
(a) Headless UAT web và/hoặc iOS theo scope — scripts/web-uat.sh / sim-uat.sh; artifacts gitignored paths ghi trong index
(b) Local iOS build evidence khi đụng mobile — KHÔNG EAS Cloud; Team BLUA62D52G
(c) Deploy prod — chỉ nếu ủy quyền; mặc định ghi “chưa deploy”
(d) Review artifacts + exact SHA

## OUT
Pilot ready; device/venue claim; deploy/store; mở feature OUT O14

## AC
1. Index đủ SHA + commands + artifact paths cho Stories IN đã merge
2. Ít nhất một vòng headless UAT real API (không prototype file://) trên tip tích hợp hoặc per-surface đã ghi
3. Local xcodebuild/prebuild log path cho Gate và/hoặc attendee iOS
4. Verdict milestone: acceptance complete đợt UX — **không** pilot ready (O06 mở)

## Checks
- Không yêu cầu pnpm toàn monorepo trừ khi chạy UAT
- reviewer-dod đọc index trên exact integration SHA

## Deps
- Soft: có thể bắt đầu index từ main ngay (A5)
- Hard đóng #236: #232 merged + (#256/#257 nếu vẫn trong đợt đóng #222/#254) + UAT/build rows đủ
```

### T-PARENT-CLOSE — checklist coordinator (không spawn coding)

```markdown
## Sau Wave A/B
1. #230 Hoàn thành khi #232 merged+DoD
2. #233 Hoàn thành (children đã CLOSED) + note trong #236
3. #254 Hoàn thành khi #256+#257 merged+DoD+CI
4. #236 Hoàn thành khi T-236 AC đủ
5. #222 Hoàn thành khi parents trên + (nếu gộp) #246±invite Done; comment VI evidence
Không tạo Issue trùng; không mutate Status từ planner session này.
```

---

## 5. Handoff → coordinator gốc

### Làm ngay (độc lập)

1. **Không** dispatch feature #246/#invite trong khi 3× Chờ duyệt / CI #268 đỏ — fill review/fix (đã cover bởi run_86 / run_124).
2. **#236**: nhận UAT/evidence theo Spec T-236 — **độc lập** thu thập trên `main` + cập nhật khi #232/#256/#257 merge.
3. Sau reval #263 PASS: **merge PR #263** → #232/#230.
4. Reconcile #266/#267 (đã CLOSED #266) — chỉ còn #267.

### Khi slot web free + queue dưới cap

5. `worker-start` **#246** (Spec T-246) — Role `web`.
6. Tạo Issue invite → `worker-start` T-INVITE (serial sau #246 trừ khi user đổi thứ tự).

### Không làm từ planner

- GitHub Issue/Status/PR/merge/commit/push
- Source/test runtime chưa giao
- Spawn worker con / trùng run_86 / run_124

### Ready queue tóm tắt (1 dòng)

`[A5 #236 evidence NOW] ∥ [A1–A4 qua run_124/run_86/coordinator] → [B1 #246 khi WIP web OK] → [B2 invite Issue+dispatch] → [C parent close]`
