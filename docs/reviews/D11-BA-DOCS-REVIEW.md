# D11 — DoD review: BA research + coordinator docs (#224)

| Trường | Giá trị |
| --- | --- |
| Verdict | **PASS with known gap** (DOCS RESEARCH QUALITY ONLY — không phải product acceptance) |
| Reviewer | Role `reviewer-dod` — [`docs/agents/roles/reviewer-dod.md`](../agents/roles/reviewer-dod.md) |
| Agent | Cursor (`orca-agent-routing.mdc`); session ≠ implementer `ctx_ba1b62ca6533` |
| Worker terminal | `term_30314005-d256-460d-b86f-c2f247ad7e9b` |
| Task / Dispatch | `task_a3b52609d3c0` / `ctx_0ee9a6a8e05c` |
| Run | `run_61b25d359766` |
| Scope Issue | Epic [#222](https://github.com/hangndat/ticket-solution/issues/222) → Story [#223](https://github.com/hangndat/ticket-solution/issues/223) → Task BA [#224](https://github.com/hangndat/ticket-solution/issues/224) |
| Ownership artifact | **Chỉ** file này (`docs/reviews/D11-BA-DOCS-REVIEW.md`) |
| Source baseline SHA | `3e61cde42d55654897048d6d627ab6834b54b808` (= local `HEAD` lúc review) |
| Content under review | **UNCOMMITTED / chưa CI** — không gán baseline SHA cho nội dung docs |
| Ngày review | 2026-10-18 (UTC checkpoint ~2026-10-17T16:46Z) |
| Runtime tests | **Không** (docs-only) |

## Files under review (frozen) — SHA256 snapshot

| File | git status | SHA256 |
| --- | --- | --- |
| `docs/plans/D11-BA-RESEARCH.md` | untracked | `d8089c7df7894f2cccdb1a4d3a0f5207a7d5379d053aa111a053fff41323c479` |
| `docs/PRD.md` (O11 callout) | modified | `50a3184e170c84b406c58d3b913e5458dea75b3cb8412eba46089a315f142774` |
| `docs/DECISION-LOG.md` (O11) | modified | `a1ee08a9144ae05d6610f0fb1c9c49296bcc3e3d6e0e588d233930240a5ddf7d` |
| `docs/ROADMAP.md` (note D11 đầu file) | modified | `93de83e54b27b3b2898b1e9868953993fc6eac9da0985ffc8b1c0ce92f77b183` |
| `docs/reviews/D11-DISCOVERY-BASELINE.md` | untracked | `3220ca714c7ad3ca41b422f2f0b1268d7e15178dda620e0faf4bee6f24c3f736` |

**Pin:** baseline source = `3e61cde42d55654897048d6d627ab6834b54b808`. Nội dung trên là working-tree snapshot; **chưa commit / chưa CI**. PD/plan đang sửa **ngoài** scope review này.

## Checks (docs quality)

| Check | Kết quả |
| --- | --- |
| 7 personas khớp PRD §3 | PASS — Platform Operator, Tenant Owner, Event Manager, CS, Supervisor, Scanner, Attendee |
| Journeys PRD §7 × evidence | PASS — 10 bước; phân biệt quan sát reviews vs chưa pilot; bước 5 cập nhật [#200](https://github.com/hangndat/ticket-solution/issues/200) + `D9-E2E-WEB-IOS-TICKET-DOD.md`; bước 6 tách ví offline vs Gate offline D7 |
| Pain historical vs fresh | PASS — D8 screenshots = lịch sử; privacy 404 + `vemoki.com` 200 = tươi 2026-10-18; admin IA đối chiếu source `admin-form.tsx` (1930 dòng; headings khớp) |
| Benchmark 3–5 nguồn official | PASS with gap — 5 sản phẩm; Eventbrite / Ticketbox / Accelevents (+ Fever marketing) re-verify HTTP 200; Splash + Fever Zendesk help bị WAF/403 từ reviewer curl (xem findings) |
| Fix vs mở rộng | PASS — bảng §3.3, §7, §8; Reject payment/seat/Wallet/Android |
| AC Given/When/Then + metrics baseline chưa đo | PASS — §9–§10 rõ “Chưa đo”; không bịa analytics |
| Không đổi business invariant | PASS — O11 + research OUT cứng giữ O10; không tự chốt O06 số |
| Scope research/design vs roadmap review | PASS — PRD O11, ROADMAP note, baseline, research header/§13 |
| Production / pilot / store / O06 | PASS — gates G-A…G-E; prep ≠ submit; sim ≠ venue; O06 chặn production data |
| Graph stale | PASS — ghi `head_matches_build=false`; pain từ docs/reviews |
| Source links evidence nội bộ | PASS — phụ lục A files tồn tại; screenshot D8/D11 baseline có trên disk |
| Câu hỏi / ủy quyền | PASS with nit — §12 không còn hỏi lại ủy quyền; còn lệch wording §13/§15 (finding) |

Reviewer re-ran: `curl` privacy → **404**; `scripts` evidence paths tồn tại; `wc -l apps/web/app/admin/admin-form.tsx` → **1930**; `gh issue view 200` → CLOSED đúng title D9 E2E.

## Findings

### Should-fix

1. **Benchmark Splash / Fever Zendesk không re-verify được nội dung (severity này).**
   URLs Splash (`splashthat.com/platform/*`) và Fever Partners Zendesk validate-ticket trả **HTTP 403** (Cloudflare / bot challenge) với curl desktop UA. Eventbrite, Ticketbox, Accelevents, Fever business marketing vẫn **200**. Không kết luận link “sai”; chỉ **không xác nhận lại** claim chi tiết từ các trang bị chặn. Đủ ≥3 nguồn kiểm chứng được cho acceptance research; gap ghi nhận.

2. **Lệch wording sau khi giảm câu hỏi §12.**
   §12: không cần user trả lời bảng để hoàn tất handoff; chỉ cần review roadmap trước coding.
   §13 flowchart vẫn `User trả lời §12` và §15: “sau khi user trả lời §12”. Nên chỉnh thành “user review roadmap / chốt phạm vi IN” để khớp §12 + ROADMAP gate — **không** blocker research quality.

### Nit

3. PRD dòng header vẫn “quyết định: DECISION-LOG O10” trong khi đã có callout O11.
4. DECISION-LOG bảng Lịch sử chưa có dòng 2026-10-18 cho O11.
5. Ticketbox hàng benchmark ghi “App Store listing” nhưng chỉ link Play Store + ticketbox.vn.

### Không phải finding (đã đúng)

- Không claim pilot/production ready / store submit.
- Không hồi sinh Android/payment/refund/transfer/seat/Wallet.
- Không coi graph stale là truth.
- Metrics baseline = chưa đo.
- Coordinator baseline pin SHA + “docs chưa commit”.

## Limitations

- Verdict = **docs research quality only**; không nghiệm thu product/UAT/device.
- Không review PD (`docs/design/**`) hay planner plan đang sửa.
- Không chạy Playwright lại trên `vemoki.com` (tin baseline coordinator + curl privacy).
- Working-tree hashes trên sẽ lệch nếu file bị sửa sau review → cần revalidation.

## Verdict

**PASS with known gap**

Gaps chấp nhận được cho DoD docs research: (1) một phần URL benchmark không re-fetch nội dung do WAF; (2) residual “User trả lời §12” vs §12 đã bỏ hỏi handoff. Không thiếu gate bắt buộc của task (7 personas, pains có nguồn, ≥3 benchmark verify được, AC/metrics chưa đo, fix vs mở rộng, O06/pilot/store limits, không đổi invariant).
