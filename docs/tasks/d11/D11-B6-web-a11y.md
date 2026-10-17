# Spec đề xuất — D11-B6-web-a11y

> **CHƯA APPROVED** coding. Parent [`D11-B6-a11y.md`](./D11-B6-a11y.md) = TEMPLATE.
> **Một Issue / một Dispatch / `web` only.**

## Vai trò chuyên môn

- Role ID: `web` · File: `docs/agents/roles/web.md` · Agent: cursor

## Mục tiêu

A11y AA residual trên routes web được chọn (PD checklist); `prefers-reduced-motion`; contrast; không màu-only signals.

## Phụ thuộc

- Soft: PD §3 / a11y
- Tokens `brand/vemoki/tokens.json` — không đổi O09 trừ user chốt
- Ready queue: không ∥ feature web khác cùng slice

## Ownership

`apps/web` only.

## AC

- [ ] Checklist a11y PD pass trên routes được chọn
- [ ] Ghi phần chỉ kiểm thủ công vs automated
- [ ] `scripts/web-uat.sh` smoke + artifacts
- [ ] `reviewer-dod` exact-SHA

## Proof limits

Prototype ≠ runtime a11y pass (PD D5).

## OUT

iOS a11y; redesign toàn app; O09 không ủy quyền.
