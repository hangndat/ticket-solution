# D11 — DoD review: Epic planner package (#226)

| Trường | Giá trị |
| --- | --- |
| Verdict (revalidation) | **PASS** (PLAN / SPEC PROPOSAL QUALITY ONLY — không approval coding · không product acceptance · không pilot) |
| Verdict (original `ctx_d3dee44e376d`) | **SUPERSEDED** — đã là `PASS with known gap`; 3 findings sau đó đã fix; không dùng để đóng #226 |
| Reviewer | Role `reviewer-dod` — [`docs/agents/roles/reviewer-dod.md`](../agents/roles/reviewer-dod.md) |
| Agent | Cursor (`.cursor/rules/orca-agent-routing.mdc`); ≠ implementer planner `ctx_207c4324db7d`; ≠ planner-fix `ctx_81c1b6f76ffd`; ≠ BA/PD |
| Worker terminal | `term_06c87140-076b-480b-b0f6-e8ad147c3d0e` |
| Revalidation Task / Dispatch | `task_b546a05237b9` / `ctx_2ebf00a78094` |
| Original Task / Dispatch | `task_4097358a7c59` / `ctx_d3dee44e376d` (premature worker_done — superseded) |
| Run | `run_61b25d359766` |
| Scope Issue | Epic [#222](https://github.com/hangndat/ticket-solution/issues/222) → Story [#223](https://github.com/hangndat/ticket-solution/issues/223) → Planner [#226](https://github.com/hangndat/ticket-solution/issues/226) |
| Ownership artifact | **Chỉ** file này (`docs/reviews/D11-PLAN-REVIEW.md`) |
| Source baseline SHA | `3e61cde42d55654897048d6d627ab6834b54b808` (= local `HEAD`; **không** = content SHA docs) |
| Content under review | **UNCOMMITTED / chưa CI** — pin SHA256 revalidation bên dưới |
| FIX_FROZEN | `msg_5ccb7e11f665` (2026-10-17T17:00:50Z) — fix worker `ctx_81c1b6f76ffd` done/released |
| Ngày | Original review + revalidation 2026-10-18 |
| Runtime tests | **Không** (docs-only) |

---

## Revalidation (sau FIX_FROZEN) — SHA256 cuối

Pin lúc revalidation (~2026-10-17T17:01Z UTC). Baseline source vẫn `3e61cde42d55654897048d6d627ab6834b54b808`.

| File | SHA256 |
| --- | --- |
| `docs/plans/D11-UX-PRODUCTION-PLAN.md` | `c0385e382364117a458de5a2c11814a9fb3d804ceb30b954e9e6e61e9b2120d5` |
| `docs/tasks/d11/README.md` | `a54d10e471da23fa0a2f9d6da44cbc403720b434091426a855fbc28641d49416` |
| `docs/tasks/d11/D11-A1-ba-research.md` | `ed8721c7db63a982ef54b01a24b21423bc9a0201f7fae74f719ebbb45f42450e` |
| `docs/tasks/d11/D11-A2-pd-design.md` | `2195c4161eecf6c31b367f4afcac1faf8c20510806c94361d443a0a4a2cb8386` |
| `docs/tasks/d11/D11-A3-planner.md` | `29f86656c0fe434eb6112e793604e03bf398da3119dfa0c7d003b587c571dd08` |
| `docs/tasks/d11/D11-A4-reviewer-discovery.md` | `2316afd02f248c9ae1975d9a8f343eb6096e2ce4824707cb40676f50a75ef846` |
| `docs/tasks/d11/D11-B1-privacy-ux.md` | `bf62bfefaa41fded74c747603f04b560189979613f1a669275de88c15f7c5e52` |
| `docs/tasks/d11/D11-B2-attendee-web.md` | `96f461cc8060b9bfa3a08887614ff2f26bf832ae02afcad6edfa87cc3a15ccd2` |
| `docs/tasks/d11/D11-B2-web-home.md` | `a9cbfd8eff7fc0bbf0c107f6c85b27106403cc4d3e9bbdeb96495afd0f247685` |
| `docs/tasks/d11/D11-B2-web-invite.md` | `f22ec8112bef48b9ab98f26d6c5a3ff14bb0fd3d340db4ad8185177abfedb131` |
| `docs/tasks/d11/D11-B2-web-redeem.md` | `83db54100f09f30a2496923ed2f668140315a38f65f84a4b9f238557beaf0df6` |
| `docs/tasks/d11/D11-B3-attendee-ios.md` | `8cece506a785e430bf0442124fa8cb129d0894a324302bd31d754668412b5498` |
| `docs/tasks/d11/D11-B4-gate-staff-ux.md` | `fdbc1ab70dc65d67ec9f15ef048b662608751a09767c7bf959429db3c84db31e` |
| `docs/tasks/d11/D11-B4-ios-staff-scan.md` | `f195cd9be122d0914587008007e71fafd25ab7360d46caef3546cfa7413f3cc8` |
| `docs/tasks/d11/D11-B4-web-gate.md` | `f0497d7058cf19e9b566e425bb44f81716ce324105c5b1829d1708fb7f23d91e` |
| `docs/tasks/d11/D11-B4-backend-validate-only.md` | `ec81d588f0f498383ff36c496e1b6f6b8740b9d9f1ccd53f24feadcb8f3fb020` |
| `docs/tasks/d11/D11-B5-admin-ops-ux.md` | `0d4aed82522ee9e86ed3851ec1118d7ca485e77e0d0b284c2badfd0b09c2eada` |
| `docs/tasks/d11/D11-B6-a11y.md` | `607ebadf95dbe2b11e4f9f615b002b016345b97fa4ba2a04709247368d941800` |
| `docs/tasks/d11/D11-B6-web-a11y.md` | `22dd28becd7f43715bdb2528528a3a1ec50f7c45763b7a201de109d288d40b48` |
| `docs/tasks/d11/D11-B6-ios-a11y.md` | `ee5213fb3acddd7d3fc9578d37835b1f7a05d688b3b4dbf459afac27c1e47760` |
| `docs/tasks/d11/D11-B7-metrics-release.md` | `87b6d943d78d74d92f07b5c69e7afbb4efc3c878fd593a86d20e512cad8fca60` |
| `docs/tasks/d11/D11-B7-backend-metrics.md` | `e9326b4c30989cb1c15e1aacf9903e0f0fbd5af48dac1c0481c7987900163a30` |
| `docs/tasks/d11/D11-B7-coordinator-release-docs.md` | `93528277cd2c1e361330106f5ba70b7f2b9a2a8c3c95a4b9607d5d4df4789d8e` |
| `docs/tasks/d11/D11-B8-milestone-gate.md` | `ef5f0d21cf8b7c51da15ec4aefbad81b3999ed668018e95a0535864ce35ebefa` |
| `docs/tasks/d11/D11-S-P0-C-brand-test-ac.md` | `bd5b73a762cb68f9f4cdb885cc7fb7c272aef0a2c18c5465c5faad51089cc443` |

Evidence liên kết (không phải ownership review này): `docs/reviews/D11-PROTOTYPE-HEADLESS-QA.md`, `docs/reviews/D11-PD-REVIEW.md` — tồn tại trên disk (coordinator FIX_FROZEN).

### Findings gốc → trạng thái

| # | Finding gốc | Sau fix | Kết quả |
| --- | --- | --- | --- |
| 1 | Stale §5.1 “staff-scan **thiếu file**” (blocker đến khi sửa) | §5.1 ghi prototype `staff-scan.html` **đã có**; “không claim thiếu file hiện tại”; lịch sử chỉ reconcile #1. `rg` không còn claim stale. File trên disk OK. | **RESOLVED** |
| 2 | Multi-slice B2/B4/B6/B7 chưa nhãn TEMPLATE / chưa tách | Parents = **TEMPLATE NOT DISPATCH-READY**; sub-specs 1 ownership (`B2-web-*`, `B4-ios/web/backend`, `B6-web/ios`, `B7-backend/coordinator`); README + plan §5.1.1/§11 cấm dispatch parent. | **RESOLVED** |
| 3 | S-P0-C thiếu AC cụ thể trên B2/B3/B5 | `D11-S-P0-C-brand-test-ac.md` + plan §5.1 S-P0-C: ≥2 tenant/event; brand source/tokens/fallback; sau switch/logout không lẫn theme; **API/auth unchanged**; headless `web-uat`/`sim-uat` + artifact paths. Linked từ B2-web-*, B3, B5. | **RESOLVED** |

### Regression guards (revalidation)

| Guard | Kết quả |
| --- | --- |
| Wave ≤1 feature / ownership slice | **PASS** — README WIP; plan §5.3 / §11 |
| O06 mở; không PII / retention bịa | **PASS** — plan §2.3/§6/§7; B1 hard deps |
| Không public privacy “TBD” | **PASS** — B1 + plan §6 |
| Không đổi auth / quota / check-in / O05 | **PASS** — non-goals; brand AC “API auth unchanged”; B4 không nới O05 |
| Không production / pilot claim từ discovery | **PASS** — headers CHƯA APPROVED; proof limits prototype ≠ runtime |
| Optional S-P1-C không thành mandatory | **PASS** — optional + backend sub-spec capability chưa approved |
| Không self-authorize deploy/store | **PASS** |

### Revalidation checklist

- [x] Chờ `FIX_FROZEN` (`msg_5ccb7e11f665`) trước khi đọc target / worker_done
- [x] Pin SHA256 mới (25 files plan+tasks) + baseline source SHA
- [x] 3 findings RESOLVED — **không** còn blocker
- [x] Guards không regress
- [x] Verdict = plan/spec **proposal quality** cho user review roadmap — **không** approval feature coding

---

## Original review (`ctx_d3dee44e376d`) — lịch sử

> Giữ để audit. **Verdict cũ SUPERSEDED.** Snapshot SHA256 dưới đây là **trước** planner-fix — không dùng làm pin hiện tại.

| Trường | Giá trị lúc đó |
| --- | --- |
| Verdict | PASS with known gap (3 should-fix / §5.1 coi blocker đến khi fix) |
| Task / Dispatch | `task_4097358a7c59` / `ctx_d3dee44e376d` |
| Plan SHA256 (cũ) | `5ae6dc19052044145ecca60285e9d52462cb0ffcdaa29fd1f6778fa7c0723dbc` |

### Original findings (tóm tắt)

1. **Should-fix / blocker đến fix:** Plan §5.1 claim staff-scan thiếu file dù file đã có.
2. **Should-fix:** B2/B4/B6/B7 multi-slice = TEMPLATE chưa tách — chưa dispatch-ready.
3. **Should-fix:** S-P0-C không có Spec/AC riêng trên B2/B3/B5.

Early findings mailbox: `msg_8a662a4a7f94`. Premature worker_done race → escalation `msg_38b712eb94d1`; re-dispatch `ctx_2ebf00a78094`.

### Original positives (vẫn đúng sau fix)

- Pha A vs B; discovery ≠ code ≠ acceptance ≠ pilot
- WIP ≤1/slice; O06/privacy/O10/O11 OUT
- Role ID + path; soft deps thật; S-P1-C optional
- Linked evidence paths tồn tại

---

## Limitations

- Verdict = **plan/spec proposal quality only** — đủ Gate roadmap review (user Gate 4); **không** ủy quyền coding / merge / deploy / store / pilot.
- Docs **uncommitted**; hash lệch nếu sửa sau pin → revalidation lại.
- Không sửa target; không board/commit/PR.
- Không chấm PD visual polish / product UAT (chỉ xác nhận path evidence tồn tại theo FIX_FROZEN).

## Verdict cuối

**PASS** — chất lượng kế hoạch + task specs proposal (#226) sau planner-fix: đủ để **user review roadmap**; không còn blocker trong 3 findings đã yêu cầu; pha B vẫn **CHƯA APPROVED** cho coding (đúng thiết kế, không phải gap chất lượng).
