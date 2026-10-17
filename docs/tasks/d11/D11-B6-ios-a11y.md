# Spec đề xuất — D11-B6-ios-a11y

> **CHƯA APPROVED** coding. Parent [`D11-B6-a11y.md`](./D11-B6-a11y.md) = TEMPLATE.
> **Một Issue / một Dispatch / `ios` only.**

## Vai trò chuyên môn

- Role ID: `ios` · File: `docs/agents/roles/ios.md` · Agent: cursor
- Expo skills trước code; Team `BLUA62D52G`; **cấm** EAS Cloud

## Mục tiêu

A11y residual iOS: label/focus/VoiceOver trên màn được chọn; reduced motion; không màu-only.

## Phụ thuộc

- Soft: PD a11y / HIG notes
- Tokens D6 — không đổi O09 trừ user chốt

## Ownership

`apps/mobile` only.

## AC

- [ ] Checklist a11y PD trên screens được chọn
- [ ] Ghi manual vs automated
- [ ] `scripts/sim-uat.sh` smoke + artifacts
- [ ] `reviewer-dod` exact-SHA

## Proof limits

Sim ≠ device; prototype ≠ QA pass.

## OUT

Web a11y; EAS Cloud; redesign toàn app.
