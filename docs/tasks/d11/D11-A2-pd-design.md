# Spec — D11-A2 PD design + prototype

## Tracking

- Epic: [#222](https://github.com/hangndat/ticket-solution/issues/222)
- Story: [#223](https://github.com/hangndat/ticket-solution/issues/223)
- Task Issue: [#225](https://github.com/hangndat/ticket-solution/issues/225)
- Parent plan: `docs/plans/D11-UX-PRODUCTION-PLAN.md`

## Vai trò chuyên môn (bổ sung)

- Role ID: `product-design`
- File: `docs/agents/roles/product-design.md`
- Đọc file role SAU AGENTS.md và rule Orca; brand/UI rules repo thắng default AI look.
- Không mở rộng MVP; không code `apps/web` / `apps/mobile`.
- Agent: cursor

## Ownership

- **Chỉ:** `docs/design/D11-PRODUCTION-UX-UI.md`, `docs/design/d11-prototype/**`
- **Không:** apps, contracts, lockfile, files ngoài ownership

## Mục tiêu

Handoff đủ 5 mục DoD role PD + prototype tương tác đánh dấu **demo** (không giả production).

## Deliverables bắt buộc

1. User flow (persona + nhánh lỗi/denied) — web vs iOS
2. States: empty / loading / ready / error / denied (+ offline Gate nếu scope)
3. a11y: WCAG 2.2 AA mục tiêu; checklist
4. UI AC quan sát được → map `web-uat` / `sim-uat`
5. Hướng dẫn triển khai: ownership web/ios; token; contract gaps → flag coordinator

Prototype: static/HTML trong `d11-prototype/`; mọi màn ghi rõ demo.

## Phụ thuộc

- ∥ BA #224; soft-consume BA khi có — không stall vô hạn nếu BA chậm (ghi giả thuyết).
- Đọc skill trước khi review source mobile: expo-overview + RN; web: Vercel React — chỉ khi cần audit observed UI.

## Acceptance criteria

- [ ] `D11-PRODUCTION-UX-UI.md` đủ 5 mục
- [ ] Prototype có ≥1 flow chính tương tác; banner/label demo
- [ ] Tách observed (từ source/review) vs assumed
- [ ] Không yêu cầu Android/Wallet/payment

## Evidence

Artifact paths; docs-only OK.

## Proof limits

Design ≠ pilot ready; prototype ≠ UAT thiết bị.
