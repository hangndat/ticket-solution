# DoD revalidation R2 — PR #356 / Issue #322 (Age Rating questionnaire)

| Trường | Giá trị |
| ------ | ------- |
| Reviewer / session | Orca `reviewer-dod` (+ expertise `product-ba`) · terminal `term_53d51ce8-b74e-4459-8f52-92e82a3e2192` · task `task_4b3e3d8316fd` · dispatch `ctx_39f3312cfc4d` · **≠** session implementer BA |
| Role | `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` · đọc thêm `docs/agents/roles/product-ba.md` |
| Scope | PR [#356](https://github.com/hangndat/ticket-solution/pull/356) · Issue [#322](https://github.com/hangndat/ticket-solution/issues/322) · Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · paths `docs/asc/age-rating-questionnaire.md` + `docs/reviews/D13-BA-AGE-RATING.md` |
| Commit SHA | **`edb6d6acf8f0d89fceaf141b54fd6d6ac10f1863`** (`git rev-parse` + `gh pr view 356 --json headRefOid` — khớp live API head) |
| Ancestry | BA content fix `3279a0f0b3beebd6c9a60ab38d92089a0c97f091` là ancestor của tip; prior FAIL `a7258534ac4116bf961b6975ae159d1bb9bf3419` **không** tái dùng verdict |
| Architecture impact | **Không** (đối chiếu: đúng — ASC questionnaire docs only) |
| Ngày review | **2026-10-18** (UTC) |
| ASC mutate / login / cloud | **Không** (reviewer không PATCH / không login ASC trong session) |
| Prior FAIL artifact | [D13-PR356-DOD.md](./D13-PR356-DOD.md) @ `a7258534…` |

---

## 1. Checks trên exact SHA

| Check | Kết quả |
| ----- | ------- |
| Tip PR = SHA yêu cầu | **PASS** — local HEAD + GitHub `headRefOid` = `edb6d6acf8f0d89fceaf141b54fd6d6ac10f1863` |
| Diff ownership | **PASS** — PR chỉ 2 file docs; không `apps/**` |
| CI PR #356 @ tip | **PASS** — `changes` + `ci` xanh; backend/web/mobile skip (docs-only) — Actions run `39111841826` |
| CRG gate | **PASS** — `code-review-graph-ticket` `list_graph_stats` sẵn sàng (docs review; graph branch lệch worktree docs — không chặn docs-only) |
| Source spot-check (chat / web / published media) | **PASS** — không chat/report surface trong `apps/mobile/src` (chỉ “messaging” test offline-queue); `oidc-login.ts` dùng `WebBrowser.openAuthSessionAsync`; `PublishedEvent*` + `EventMediaHeader` có trong mobile tree |
| Apple / PRD alignment (UGC) | **PASS** — `userGeneratedContent: true` + `socialMedia: false` tách đúng định nghĩa Apple + PRD M03/M04 |
| Runtime tests | **N/A** (docs-only) |

---

## 2. Đối chiếu accept criteria (sau FAIL `a7258534…`)

| Tiêu chí coordinator | Evidence @ `edb6d6…` | Verdict |
| -------------------- | -------------------- | ------- |
| `userGeneratedContent=true` khớp Apple + PRD | §3 + §4.2 #4 + §6A JSON = `true`; social vẫn `false` | **Met** |
| U1 userOK gate removed | §5 U1 **Đóng (technical)** — không hỏi user “Apple nghĩa là gì” | **Met** |
| U2 MED omitted | alcohol / mature / sexual* = *omit đến U2*; không có trong §6A | **Met** |
| §6A HIGH-only partial (không all-4+ / full-NONE ready PATCH) | §0 + §6A + §6B cấm full MED=`NONE`; không claim “all 4+” | **Met** |
| Guideline 1.2 publish-readiness gap documented honestly | §5b: có gate publish/role + contact; **gap** report-in-app; **không** claim pass 1.2 | **Met** |
| No ASC mutate in session | Reviewer không gọi ASC API; docs cấm mutate từ BA | **Met** |

Prior blockers (UGC false + full MED-NONE payload + U1 definition gate) **đã sửa** trong `3279a0f…` / tip `edb6d6…`.

---

## 3. Phân tách nghiệm thu

| Cổng | Verdict | Ý nghĩa |
| ---- | ------- | ------- |
| **Docs-readiness** | **PASS** | Ma trận + UGC fix + partial §6A + 1.2 gap note đủ để merge docs / bàn giao ops có ràng buộc |
| **Answers-ready-to-PATCH (final / all keys)** | **Blocked (known gap)** | U2 mở — chỉ §6A khi root/ops được ủy quyền; **cấm** full questionnaire im lặng |
| **ASC applied / rating live / all 4+ / 1.2 compliance** | **NOT claimed** | Đúng non-goals |

---

## 4. Findings

### Blocker
Không còn blocker docs so với accept list R2.

### Should-fix / nit (không chặn PASS docs)
1. **PR body** vẫn ghi tip SHA cũ `a7258534…` trong checklist Evidence — nên cập nhật sang `edb6d6…` (metadata PR, không đổi nội dung questionnaire).
2. `D13-BA-AGE-RATING.md` §10 pin BA fix `3279a0f…`; tip PR = `edb6d6…` (pin SHA artifact) — ancestry OK; có thể ghi rõ tip = `edb6d6…` trong bảng tip nếu muốn một dòng duy nhất.

### Giữ nguyên (đúng)
- U2 / U3 async chưa trả lời → omit MED + override.
- Violence / gambling / ads / unrestricted web HIGH — giữ.
- Không implement report/block trong PR này.

---

## 5. Limitations

- Không login ASC; không đọc live `ageRatingDeclarations` attributes trong session này.
- Không audit media event private; public catalog vẫn không lộ list published để đóng U2.
- Graph MCP build SHA lệch branch docs worktree — không dùng để thay source spot-check.

---

## 6. Verdict

| | |
| --- | --- |
| **Docs-readiness / DoD docs AC** | **PASS with known gap** |
| **Known gaps (chấp nhận có chủ đích — không nuốt gate docs)** | (1) U2 mở → final MED keys + calculated rating panel vẫn blocked; (2) Guideline 1.2 thiếu report-in-app — đã ghi §5b, ngoài impl PR; (3) Ops PATCH ASC **ngoài** PR này |
| **Answers-ready-to-PATCH final** | **Không PASS** — chỉ partial §6A khi được ủy quyền |
| **Reuse prior FAIL?** | **Không** — verdict chỉ cho `edb6d6acf8f0d89fceaf141b54fd6d6ac10f1863` |

**Authoritative:** **PASS with known gap** trên exact SHA tip — đủ DoD docs cho PR #356 theo accept list R2; **không** đồng nghĩa sẵn full PATCH ASC hay store submit.

Coordinator: có thể merge docs khi được ủy quyền integration + CI xanh; **không** Project `Hoàn thành` #322 như “age rating live”; **không** mutate ASC từ verdict này. Reviewer **không** merge / không đổi Project.
