# D11 — DoD review: Product Design + prototype (#225)

| Trường | Giá trị |
| --- | --- |
| Verdict | **PASS with known gap** (DESIGN / PROTOTYPE REVIEW ONLY — không phải product acceptance) |
| Reviewer | Role `reviewer-dod` — [`docs/agents/roles/reviewer-dod.md`](../agents/roles/reviewer-dod.md); PD checklist đối chiếu [`docs/agents/roles/product-design.md`](../agents/roles/product-design.md) |
| Agent | Cursor (`orca-agent-routing.mdc`); session ≠ implementer `ctx_08badda9c351` / fix `ctx_c25fa83c254d` |
| Worker terminal | `term_b6c15ec6-8dc1-45f3-b0e4-f126eb3caab7` |
| Task / Dispatch | `task_993e89fa1f34` / `ctx_55add22b4e29` |
| Run | `run_61b25d359766` |
| Scope Issue | Epic [#222](https://github.com/hangndat/ticket-solution/issues/222) → Story [#223](https://github.com/hangndat/ticket-solution/issues/223) → Task PD [#225](https://github.com/hangndat/ticket-solution/issues/225) |
| Ownership artifact | **Chỉ** file này (`docs/reviews/D11-PD-REVIEW.md`) |
| Source baseline SHA | `3e61cde42d55654897048d6d627ab6834b54b808` (= local `HEAD` lúc review) |
| Content under review | **UNCOMMITTED / chưa CI** — không gán baseline SHA cho nội dung design/prototype |
| Ngày review | 2026-10-18 (UTC checkpoint ~2026-10-17T16:56Z) |
| Target edits | **Không** — frozen; không commit/push/PR/merge/board |

## Files under review (frozen) — SHA256 snapshot

| File | git status | SHA256 |
| --- | --- | --- |
| `docs/design/D11-PRODUCTION-UX-UI.md` | untracked (working tree) | `81b16b5c48156e1bcaeb9b0e8a80129e491464b8eb851d47125875f0ac67614e` |
| `docs/design/d11-prototype/index.html` | untracked | `3cede4da8e271901dda6c878a575464bb162d4ed10c73c359a214894c928a493` |
| `docs/design/d11-prototype/css/d11.css` | untracked | `2aad62c121e5bfde6260d3a68c96618c68facf0250d3758ca4d6f78878d9f92e` |
| `docs/design/d11-prototype/flows/attendee-redeem.html` | untracked | `a94d6a5190e737d7293d9a36afdf847f7924b3a8bcb336e2ab6ec9078c86565a` |
| `docs/design/d11-prototype/flows/admin-readiness.html` | untracked | `93a255f7a37ba22d6c729158fb01c769a5e1191615de4342c82e61a53c65a5c3` |
| `docs/design/d11-prototype/flows/staff-scan.html` | untracked | `6be07ecc945f4d295d21f0329ce312708e6051450011af86cfc1ea309a328272` |
| `docs/design/d11-prototype/fixtures/demo.json` | untracked | `549d6a2c7626094205389347f934b0ef929963b929699e3b041bed914be6cb2a` |

**Pin:** baseline source = `3e61cde42d55654897048d6d627ab6834b54b808`. Nội dung trên là working-tree snapshot; **chưa commit / chưa CI**. Không dùng source SHA làm content hash.

**BA reconcile input (đọc, ngoài ownership edit):** `docs/plans/D11-BA-RESEARCH.md` SHA256 `d8089c7df7894f2cccdb1a4d3a0f5207a7d5379d053aa111a053fff41323c479` (khớp snapshot BA DoD trước).

**Coordinator final QA (đối chiếu):** `/tmp/d11-prototype-final-qa/results.json` + durable [`D11-PROTOTYPE-HEADLESS-QA.md`](./D11-PROTOTYPE-HEADLESS-QA.md) / [`d11-prototype-qa/results.json`](./d11-prototype-qa/results.json) — SHA256 results `5b2e169686e412133cf1cb82a17e73bf9df974bfdca83efb29066054113a2ceb`; **29/29 PASS**; 6 file hashes khớp disk lúc review. **Không** dùng `/tmp/d11-prototype-qa/results.json` (bản FAIL cũ trước fix).

## Checks — 5 PD deliverables

| # | Deliverable | Kết quả |
| --- | --- | --- |
| 1 | User flows theo persona + nhánh lỗi/auth + touch web/iOS | **PASS** — §1 Attendee / Event Manager / Scanner; auth pin; web vs iOS map §1.4 |
| 2 | State matrix + copy VI | **PASS** — §2 redeem/wallet/admin/Gate; guest/staff VI; review dock tách chrome khách |
| 3 | Accessibility (mục tiêu + checklist; không claim đo) | **PASS** — §3 WCAG 2.2 AA mục tiêu + A1–A10; prototype hub banner «không claim a11y đạt chuẩn»; CSS `prefers-reduced-motion` |
| 4 | UI AC headless map BA | **PASS** — §4 AC-A*/M*/G* + UAT map `web-uat` / `sim-uat`; prototype file:// = design only |
| 5 | Implementation handoff ownership | **PASS** — §5 web/iOS/ops/BE escalate; thứ tự good-enough; tokens reuse |

## Checks — invariant / semantics (task)

| Check | Kết quả |
| --- | --- |
| IA theo personas (Attendee / Event Manager / Scanner) | PASS — hub + 3 flow product shells |
| Auth: không mở anonymous by design | PASS — doc D1 + redeem gate «Cần đăng nhập»; fixture `requiresAuth: true` |
| Quota NULL hợp lệ (không ép hữu hạn) | PASS — §1.2; admin checklist «không giới hạn»; fixture `capacity: null` |
| ADR-18 APPLIED / DUPLICATE / CONFLICT / unknown / queued | PASS with gap — matrix §2.4 đủ; prototype chips cover APPLIED/CONFLICT/unknown/queued/denied; DUPLICATE chỉ principles + fixture list (không chip tương tác) — xem finding |
| Không nới check-in / không fake green queue | PASS — queued/conflict/unknown tone ≠ admit (final QA + spot check) |
| P1-3 validate-only = proposal, chưa approved | PASS — review chip «P1 chỉ kiểm tra» + copy proposal; D4 |
| Demo label rõ | PASS — `demo:*` banners; vé «DEMO — KHÔNG DÙNG VÀO CỔNG» |
| Không bịa measured a11y / pilot / device / venue / user research | PASS — header «không pilot/production ready»; §3 đo khi coding; known gaps ghi rõ |
| Composition 3 flows product-like | PASS — event hero + form; admin job nav + readiness; phone shell + outcome lớn + queue |

## Checks — evidence runtime (prototype only)

| Check | Kết quả |
| --- | --- |
| Coordinator final QA `node /tmp/ticket-d11-prototype-qa.cjs` | PASS 29/29; hashes khớp frozen files; status message `msg_94da2d640f83` acked |
| Independent Playwright spot check (chrome-headless-shell-1248, file://) | PASS — empty/terms/happy/auth/stale-timer; admin quota-null/unclear/offline/job-nav; staff queued/conflict/unknown ≠ admit; applied admit; validate proposal; hub demo |
| Không mouse GUI / không apps/** | PASS |

## Findings

### Should-fix

1. **Staff prototype thiếu chip tương tác `DUPLICATE`.**  
   Spec §2.4 + principles + `demo.json` `adr18ItemStatuses` liệt kê DUPLICATE; review chips có APPLIED/CONFLICT/unknown/queued nhưng **không** có `data-phase="duplicate"`. Semantics đủ trên giấy; reviewer/implementer phải dựa matrix chứ không demo được tone DUPLICATE. Không nuốt invariant (principles: CONFLICT/DUPLICATE ≠ lượt vào mới).

### Nit

2. **§12 PD doc còn câu «Còn lại: Coordinator rerun frozen QA»** trong khi final QA đã PASS 29/29 — stale handoff note; không ảnh hưởng deliverable.

### Không phải finding (đã đúng)

- Không claim pilot/production ready / WCAG đã đo / venue UAT / user research.  
- Anonymous redeem không mở.  
- Validate-only không mock production right.  
- Review dock tách khỏi chrome khách.  
- Final QA dùng `/tmp/d11-prototype-final-qa` (và durable copy), không dùng results FAIL cũ.

## Limitations / known gaps (bắt buộc nêu)

- Verdict = **design + HTML prototype quality only** — không nghiệm thu `apps/web` / `apps/mobile`, API, RLS, concurrency.  
- **Native** Gate (camera, haptics, VoiceOver device) **chưa** chạy.  
- **Full a11y** (axe suite / screen reader thật / contrast đo) **chưa** — chỉ pattern + checklist.  
- **Venue / physical-device / user research** **chưa** chạy.  
- Working-tree hashes lệch nếu file bị sửa sau review → cần revalidation.  
- P1-3 validate-only vẫn **proposal** chờ user review roadmap — không coi đã approved.

## Verdict

**PASS with known gap**

Đủ 5 PD deliverables, reconcile BA P0/P1, auth/quota/ADR-18 (docs) / demo labels / không nới invariant, coordinator + independent headless prototype QA xanh trên hashes pin. Gaps chấp nhận cho design-review DoD: (1) thiếu chip DUPLICATE tương tác; (2) native/full a11y/venue/user research chưa chạy; (3) prototype ≠ product acceptance. Không thiếu gate bắt buộc của task review.
