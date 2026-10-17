# Spec — D11-A1 BA research

## Tracking

- Epic: [#222](https://github.com/hangndat/ticket-solution/issues/222)
- Story: [#223](https://github.com/hangndat/ticket-solution/issues/223)
- Task Issue: [#224](https://github.com/hangndat/ticket-solution/issues/224)
- Parent plan: `docs/plans/D11-UX-PRODUCTION-PLAN.md`

## Vai trò chuyên môn (bổ sung)

- Role ID: `product-ba`
- File: `docs/agents/roles/product-ba.md`
- Đọc file role SAU AGENTS.md và rule Orca; nếu xung đột → rule dự án thắng.
- Không mở rộng MVP / ngoài phạm vi Issue; không hồi sinh Android/payment/seat/Wallet.
- Agent: cursor (theo orca-agent-routing.mdc)

## Ownership

- **Chỉ:** `docs/plans/D11-BA-RESEARCH.md`
- **Không:** `apps/**`, contracts, lockfile, DECISION-LOG/ROADMAP/PRD (coordinator đã cập nhật O11), untracked có sẵn ngoài path này

## Mục tiêu

Nghiên cứu pain/journey/ưu tiên/AC cho UX/UI hướng vận hành production trên baseline D0–D10; đầu ra tiếng Việt; phân biệt quan sát / suy luận / giả thuyết.

## IN / OUT

**IN:** Personas PRD §3; luồng PRD §7; gap từ reviews (D6–D10, O06, privacy 404); non-goals; metric *đề xuất* cách đo.  
**OUT:** Phỏng vấn bịa; số baseline bịa; feature coding; tuyên bố pilot ready; chốt O06 số liệu thay user.

## Phụ thuộc

- Song song với PD #225 và Planner #226 — **không** hard-block lẫn nhau.
- Soft: đọc plan draft khi có.

## Acceptance criteria

- [ ] File `docs/plans/D11-BA-RESEARCH.md` có: problem/outcome; IN/OUT; journeys; ưu tiên; AC map ownership; dependencies; success evidence đề xuất
- [ ] Mỗi pain ghi **nguồn** (PRD/TD/review/path) hoặc gắn nhãn giả thuyết
- [ ] Không bịa phỏng vấn/metrics/UAT
- [ ] Không mở O10-hủy scopes

## Evidence

- Path artifact + (nếu commit sau này do coordinator) exact SHA
- Không bắt buộc runtime checks (docs-only)

## Proof limits

Research complete ≠ code/acceptance/pilot complete.
