# D13 — Execution Tracker (Epic #301)

> **Checkpoint coordinator sau handoff:** BA #314/#315/#324 đã merge + integrated CI SUCCESS, được đóng/Hoàn thành. iOS #316/#328 còn UAT đúng SHA; BE #320 có PR #342 chờ DoD/security về execution/IdP/session gaps. Web #321/#330 đang thực thi. Metadata #322 đã ghi/read-back phần EN/VI/version/name/URLs qua API, còn declarations/contact/media/gates. Các bảng Status phía dưới là snapshot planner, Project #3 thắng khi khác.

| Trường | Giá trị |
| ------ | ------- |
| Vai trò | Epic planner depth-1 (`orca-epic-orchestrator.mdc`) — **không** role coding catalog |
| Agent | `cursor` (`orca-agent-routing.mdc`) |
| Orca task / dispatch | `task_b032f3bbb89f` / `ctx_ad51e98e0db7` |
| Ngày tạo tracker | 2026-10-18 |
| Plan nguồn (không sửa) | [`D13-APP-STORE-RELEASE-PLAN.md`](./D13-APP-STORE-RELEASE-PLAN.md) |
| Board (authority) | [Project #3](https://github.com/users/hangndat/projects/3) |
| Epic | [#301](https://github.com/hangndat/ticket-solution/issues/301) |
| Milestone GitHub | [#9 — D13 — App Store publish](https://github.com/hangndat/ticket-solution/milestone/9) |
| Worktree HEAD lúc ghi tracker | `50b5a8195c33446676c7b91b2e8f9e86496ff649` (branch ops; **không** merge ops vào D13) |
| Integration `origin/main` (base consumer) | `f551b6d2bdc06742f74a49a0970cb2bfae2f4e0e` (+ merges D13 docs/BA sau đó) |
| Deploy tip D12 (baseline) | `0a65f3c2f2d51357ee1a6270151d279758188fb7` |
| Marketing / iOS version chốt | `1.0.0` (ASC draft `1.0` → ops đổi versionString ở S3; buildNumber final > latest TF `10`) |

**Ủy quyền:** User đã duyệt roadmap D13 (18/10/2026) → thực thi end-to-end đến publish store theo gates; **không** xin lại quyền upload/submit/release. Plan file chính **không** sửa trong task này.

**Architecture impact (planning/tracking):** **Không**.

**Territory:** vẫn **chưa chốt** (đề xuất VN) — chặn mềm S7-T1 / evidence territory.

**Không hứa:** acceptance complete / publish / pilot ready khi `worker_done` planner.

---

## 1. Hierarchy Issue IDs

```text
Epic #301
├── Story S1 #303
│   ├── S1-T1  #314
│   ├── S1-T2  #315
│   ├── S1-T3  #316
│   ├── S1-T4  #317
│   └── S1-T2b #318 (optional architect)
├── Story S2 #305
│   ├── S2-T1  #319
│   ├── S2-T2  #320
│   └── S2-T3  #321
├── Story S3 #306
│   ├── S3-T1  #322
│   ├── S3-T2  #323
│   └── S3-T3  #324
├── Story S4 #307
│   ├── S4-T1  #325
│   ├── S4-T2  #326
│   └── S4-T3  #327
├── Story S5 #309
│   ├── S5-T1  #328
│   ├── S5-T2  #329
│   ├── S5-T3  #330
│   └── S5-T4  #331
├── Story S6 #310
│   ├── S6-T1  #332
│   ├── S6-T2  #333
│   └── S6-T3  #334
├── Story S7 #311
│   ├── S7-T1  #335
│   ├── S7-T2  #336
│   ├── S7-T3  #337
│   └── S7-T4  #338
└── Story S8 #312
    ├── S8-T1  #339
    └── S8-T2  #340
```

Sub-issues gắn qua GraphQL `addSubIssue` (Epic→Story→Task). Mỗi Issue trên Project #3 + milestone D13.

---

## 2. Map Task — Role / AI / Deps / Status (board live)

Status lấy từ Project #3 lúc ghi tracker (board thắng docs). Spec chi tiết nằm **trong body Issue** (tự chứa).

| Code | Issue | Role ID | Path role | AI | Lý do AI | Ownership | Deps thật | Status board |
| ---- | ----- | ------- | --------- | -- | -------- | --------- | --------- | ------------ |
| Epic | #301 | — (planner/coord) | — | Không | Tracking Epic | coordinator | — | **Đang làm** |
| S1 | #303 | — | — | Không | Story tracking | Sản phẩm | — | **Đang làm** |
| S1-T1 | #314 | `product-ba` | `docs/agents/roles/product-ba.md` | Không | Chỉ đối chiếu privacy docs vs Guideline 5.1.1 | `docs/**` | không | **Chờ duyệt** (PR #308 merged `24ac8d9…`; chờ CI integrated + DoD đóng) |
| S1-T2 | #315 | `product-ba` | `docs/agents/roles/product-ba.md` | Không* | Inventory SDK; *→ S1-T2b nếu đổi contract telemetry | `docs/**` | không | **Chờ duyệt** (cùng PR #308) |
| S1-T3 | #316 | `product-ba` (+ ios toolchain) | `docs/agents/roles/product-ba.md` | Không | Đối chiếu Upcoming Requirements live | `docs/reviews` | không | **Đang làm** / UAT bổ sung (PR #313 chưa merge nếu thiếu UI UAT) |
| S1-T4 | #317 | *(planner — không catalog)* | — | Không | Reconcile wave/territory | `docs/plans` | sau S1-T1..T3 + territory | **Bị chặn** |
| S1-T2b | #318 | `architect` | `docs/agents/roles/architect.md` | **Có** | Chỉ nếu S1-T2 mở quyết định privacy SDK / network ≠ ADR | `docs/` | chỉ khi S1-T2 escalate | **Chưa lên lịch** |
| S2 | #305 | — | — | Không | Story tracking | Coordinator | — | **Sẵn sàng** |
| S2-T1 | #319 | *(coordinator)* | — | Không | Re-measure runtime tip | root / `docs/reviews` | ∥ S1 | **Bị chặn** (SMTP internet / email delivery cứng cho **S6**; verify artifact ≠ runtime ready) |
| S2-T2 | #320 | `backend` | `docs/agents/roles/backend.md` | Không† | Verify O06 path + job schedule thật (không chỉ stub NO_JOB_FRAMEWORK); †S2-T2a nếu đổi contract | `apps/api` + packages | Wave 1 verify | **Đang làm** (BE active) |
| S2-T3 | #321 | `web` | `docs/agents/roles/web.md` | Không | Verify privacy/deep-link URLs | `apps/web` | Wave 1 verify | **Sẵn sàng** |
| S3 | #306 | — | — | Không | Story tracking | iOS | — | **Đang làm** |
| S3-T1 | #322 | `ios` | `docs/agents/roles/ios.md` | Không | ASC metadata paste | ASC + `docs/reviews` | G1 URL live; sau S1 privacy OK | **Sẵn sàng** |
| S3-T2 | #323 | `ios` | `docs/agents/roles/ios.md` | Không | Screenshots ASC; cấm EAS | mobile artifacts + ASC | ∥ S3-T1 | **Sẵn sàng** |
| S3-T3 | #324 | `product-ba` | `docs/agents/roles/product-ba.md` | Không | Refresh review notes sau O06 | `docs/asc` | soft dep S1-T1 | **Chờ duyệt** (PR #308) |
| S4 | #307 | — | — | Không | Story tracking | iOS | mobile final + SDK + prod endpoints | **Bị chặn** |
| S4-T1 | #325 | `ios` | `docs/agents/roles/ios.md` | Không | Local Distribution archive | `apps/mobile` | S1-T3 + mobile final merged/DoD/CI + prod endpoints config; credential §2. **SMTP không chặn archive** (hard gate S6) | **Bị chặn** |
| S4-T2 | #326 | `ios` | `docs/agents/roles/ios.md` | Không | Upload ≠ publish | mobile + ASC | sau S4-T1; ASC API | **Bị chặn** |
| S4-T3 | #327 | `ios` | `docs/agents/roles/ios.md` | Không | Device smoke | device + reviews | sau S4-T2 processing | **Bị chặn** |
| S5 | #309 | — | — | Không | Story tracking | iOS | — | **Đang làm** |
| S5-T1 | #328 | `ios` | `docs/agents/roles/ios.md` | Không | In-app deletion/privacy UI | `apps/mobile` | sau/∥ S2-T2 | **Đang làm** |
| S5-T2 | #329 | `product-ba` (+ coord ops) | `docs/agents/roles/product-ba.md` | Không | Demo reviewer prod; không commit secret | ops IdP + docs | trước S6 | **Sẵn sàng** |
| S5-T3 | #330 | `web` | `docs/agents/roles/web.md` | Không | Headless UAT companion | `apps/web` | sau/∥ S3-T3 | **Sẵn sàng** |
| S5-T4 | #331 | `reviewer-dod` + `reviewer-security` | `docs/agents/roles/reviewer-dod.md`, `reviewer-security.md` | Không | Exact SHA ≠ implementer | review only | sau PR S5 | **Bị chặn** |
| S6 | #310 | — | — | Có (S6-T2) | Story có thể mở AI khi Apple bắt đổi KT | iOS | S3+S4-T3+S5-T2+S5-T4 | **Bị chặn** |
| S6-T1 | #332 | `ios` / coordinator | `docs/agents/roles/ios.md` | Không | Submit; ≠ publish | ASC | gates trên | **Bị chặn** |
| S6-T2 | #333 | `product-ba` → slice fix | theo slice | **Có nếu Apple bắt đổi KT** | Triage Rejection | docs + ownership | optional loop | **Bị chặn** |
| S6-T3 | #334 | `reviewer-dod` | `docs/agents/roles/reviewer-dod.md` | Không | DoD mỗi vòng | review | sau fix | **Bị chặn** |
| S7 | #311 | — | — | Không | Story tracking | Coordinator | S6 Approved / territory | **Bị chặn** |
| S7-T1 | #335 | *(coordinator)* | — | Không | Release option + territory | ASC | territory user chốt | **Bị chặn** |
| S7-T2 | #336 | *(coordinator)* | — | Không | Ready for Sale = publish path | ASC | S6 Approved | **Bị chặn** |
| S7-T3 | #337 | `product-ba` / coord | `docs/agents/roles/product-ba.md` | Không | Evidence §0 | `docs/reviews` | sau S7-T2 | **Bị chặn** |
| S7-T4 | #338 | `reviewer-dod` | `docs/agents/roles/reviewer-dod.md` | Không | Milestone DoD Epic | review | sau S7-T3 | **Bị chặn** |
| S8 | #312 | — | — | Không | Story tracking | Coordinator | sau S7-T4 | **Bị chặn** |
| S8-T1 | #339 | *(coordinator)* | — | Không | Đóng board khi §0+DoD | Project #3 | sau S7-T4 | **Bị chặn** |
| S8-T2 | #340 | *(coordinator)* | — | Không | Quan hệ D12 #293 | Project #3 | ∥/sau S8-T1 | **Bị chặn** |

Không tạo sẵn S2-T2a: chỉ khi BE verify mở quyết định contract erasure → Task architect discovery riêng.

**ASC preflight (fact iOS, che secret):** App id `6823694490`; version draft `1.0` `PREPARE_FOR_SUBMISSION`; TF builds VALID 2–10 (latest 10) nhưng relationship build=null; ASC name “Ticket Solution” ≠ Vemoki; en-US metadata thiếu + screenshotSets=0; privacy URL ASC missing (HTTP policy `vemoki.com/privacy` 200). Support URL ưu tiên `https://vemoki.com/support`. Distribution cert/profile + ASC key present; agreements/territory query 404 = Unknown.

**PRs liên quan (không do planner mở):** BA #308 merged; iOS #313 chờ UI UAT bắt buộc trước merge; coord docs #304 merged (`ce6e8ee…`).

---

## 3. Spec tự chứa (mỗi Task Issue)

Mỗi Task body đã có khối:

- Role ID + path `docs/agents/roles/<id>.md`
- Agent `cursor`
- Architecture impact + lý do
- Parent Epic/Story IDs
- Ownership paths
- Deps thật
- Acceptance checklist (theo plan §4)
- Cấm EAS / secrets / TestFlight=publish
- Link tracker này

Coordinator spawn: copy Issue body làm Task Spec; gắn Role khi `worker-start`.

---

## 4. Dependencies thật (DAG rút gọn)

```text
Wave 1 (docs/verify — không cần IPA):
  S1-T1 ∥ S1-T2 ∥ S1-T3 ∥ S2-T1 ∥ S2-T2(verify) ∥ S2-T3(verify)
  S1-T2b chỉ nếu S1-T2 escalate

Wave 2 (ASC + binary + in-app):
  S3-T3 ← soft S1-T1
  S3-T1 ∥ S3-T2  (sau privacy OK)
  S5-T1 ←/∥ S2-T2
  S5-T2 ∥ S5-T3
  S5-T4 ← PR S5
  S4-T1 ← S1-T3 + S5 mobile final merged/DoD/CI + prod endpoints + credential §2
        (SMTP **không** là dep archive)
  S4-T2 ← S4-T1
  S4-T3 ← S4-T2 processing (device sau upload)

Wave 3:
  S6-T1 ← S3 + S4-T3 + S5-T2 + S5-T4 + go/no-go + **SMTP/email delivery thật**
  S6-T2/T3 optional rejection loop

Wave 4:
  S7-T1 (territory chốt) → S7-T2 → S7-T3 → S7-T4 → S8-T1 ∥ S8-T2
```

**Không serialize giả** theo Story nếu Task đã unblocked.

---

## 5. Ready queue — max fan-out dưới capacity **3 workers**

Snapshot khi ghi tracker (board live). Capacity host = **3** feature/reviewer workers cùng lúc; cùng ownership slice: tối đa 1 feature Dispatch.

### Đang chạy (chiếm slot — không spawn trùng)

| Slot | Issue | Ownership | Ghi chú |
| ---- | ----- | --------- | ------- |
| 1 | #316 S1-T3 | BA/iOS toolchain | ASC SDK eligibility + read-only preflight |
| 2 | #320 S2-T2 | backend | BE anonymize verify (coord đã kéo sớm) |
| 3 | #328 S5-T1 | ios | Account deletion in-app |

→ **Capacity đầy (3/3).** Không spawn feature mới đến khi có slot free hoặc chuyển sang review/fix theo backpressure.

### Ready ngay khi có slot (ưu tiên)

| Ưu tiên | Issue | Role | Lý do sẵn sàng |
| ------- | ----- | ---- | -------------- |
| A | #321 S2-T3 | `web` | Wave 1 verify; độc lập BE/iOS |
| B | #322 S3-T1 | `ios` | Metadata ASC; sau privacy (S1-T1/S3-T3 đã Hoàn thành) — **cùng slice iOS với S5-T1 → chờ S5-T1 settle** |
| B′ | #323 S3-T2 | `ios` | Screenshots; cùng ràng buộc ownership iOS |
| C | #329 S5-T2 | coordinator + BA | Demo reviewer; không đụng mobile coding |
| D | #330 S5-T3 | `web` | UAT companion; có thể ∥ S2-T3 nếu gom web |
| E | #319 S2-T1 | coordinator | Board đang Bị chặn — **unblock trước** rồi fill |

### Đề xuất fill khi 1 slot free (max fan-out dưới 3)

```text
Khi S1-T3 hoặc S2-T2 hoặc S5-T1 settle:
  Ưu tiên 1: #321 web S2-T3  (hoặc #330 nếu S2-T3 đã xong)
  Ưu tiên 2: #329 S5-T2 (coord/BA) nếu không đụng slice đang hot
  Ưu tiên 3: chỉ khi iOS free → #322 S3-T1 (rồi #323)
Không mở S4-* cho đến deps cứng + credential §2.
Không mở S6 submit khi thiếu go/no-go / S4-T3 / S5-T4.
```

### Chờ duyệt / WIP (backpressure)

≥3 PR từng chờ DoD → ưu tiên **reviewer/fix** trước feature mới. BA #314/#315/#324 = **Chờ duyệt** (không Hoàn thành sớm). Fill web #321 khi slot free.

---

## 6. Wave hiện tại (theo brief + mailbox)

| Dispatch nhóm | Issues | Status board lúc tracker |
| ------------- | ------ | ------------------------ |
| BA docs/asc | S1-T1 #314, S1-T2 #315, S3-T3 #324 | **Chờ duyệt** (PR #308) |
| iOS + ASC read-only | S1-T3 #316, S5-T1 #328 | **Đang làm** / PR #313 + UAT |
| BE verify | S2-T2 #320 | **Đang làm** |
| Web verify | S2-T3 #321, S5-T3 #330 | **Sẵn sàng** (fill khi slot) |
| Runtime | S2-T1 #319 | **Bị chặn** SMTP (S6 gate) |

Epic #301 / S1 / S3 / S5: **Đang làm** (root sở hữu sync #301 — planner không đua sửa).

---

## 7. Credential / soft blockers (không bịa)

Từ plan §2 — vẫn Unknown/re-verify:

- Paid Apps Agreement / banking / tax ASC
- ASC API Key + Issuer trên máy build
- Distribution provisioning `BLUA62D52G` + `com.hangndat.ticket`
- Territory VN vs All
- SMTP internet (không chặn upload cứng; có thể fail App Review)

---

## 8. Limitations (planner task)

- Chỉ tạo hierarchy + file tracker này; **không** sửa plan chính, `apps/**`, không commit/push/PR/merge/deploy/submit.
- Không đọc secrets; không xác minh Paid Apps Agreement trên ASC.
- Status board có thể đổi sau khi worker khác chạy — **re-fetch Project #3** trước mỗi wave.
- Field Project «Đợt bàn giao» chưa có option D13 (chỉ tới D10 / Sau MVP) — dùng **GitHub Milestone #9** thay thế.
- CRG không dùng (docs/board tracking).
- `worker_done` planner ≠ Hoàn thành Epic / publish.
- Số Issue #304/#308 không thuộc D13 hierarchy (gap số; không dùng).

---

## 9. Handoff cho coordinator

1. Tracker + IDs ở trên; board đã sync Status/milestone/sub-issues.
2. Capacity 3 đang full (#316, #320, #328) → idle-fill theo §5 khi settle.
3. Unblock #319 S2-T1 khi sẵn sàng runtime re-measure.
4. Chốt territory với user trước S7-T1.
5. Spawn `--agent cursor` + Role ID trong spec; reviewer ≠ implementer.
6. Claim publish chỉ sau S7-T3 evidence §0 + S7-T4 DoD.
