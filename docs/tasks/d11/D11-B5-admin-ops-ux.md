# Spec đề xuất — D11-B5 Admin / CS / platform ops UX

> **CHƯA APPROVED.** Một ownership `web` / Dispatch.

## Vai trò chuyên môn

- Role ID: `web` · File: `docs/agents/roles/web.md` · Agent: cursor

## Mục tiêu (map BA S-P0-E / S-P1-B)

IA admin **theo việc** (Setup / Guests / Gate / Support): progressive disclosure, tenant/event context thân thiện, readiness — **không** chỉ đổi màu/bo góc. Khớp PD admin-readiness prototype + source `admin-form.tsx` (~1930LOC, quan sát).
Brand-test (S-P0-C) trên admin/event chrome: [`D11-S-P0-C-brand-test-ac.md`](./D11-S-P0-C-brand-test-ac.md) khi trong scope.

## Phụ thuộc

- Soft: PD §1.2 / §2.3 / prototype `admin-readiness.html` (prototype headless QA ≠ runtime/app QA)
- Soft: BA S-P0-E AC; S-P1-B sau P0-E
- Evidence D8 `d8-admin.png` = **lịch sử** — phải xác minh UI `main` trước claim UAT
- D8 theming — không regress white-label
- Contract/API rewrite → escalate (**không** auto-approve)

## Ownership

`apps/web` only — một Dispatch; không trộn ios/BE.

## AC khung

- [ ] Job groups + progressive disclosure theo PD
- [ ] Tenant/event context visible; ẩn UUID/mã đợt khỏi chrome chính khi có slug
- [ ] Readiness states (S-P1-B) nếu trong scope duyệt
- [ ] Brand-test AC nếu surface admin/event brand trong scope
- [ ] web-uat admin + `reviewer-dod` (± security nếu support grant)

## OUT

Rewrite API/nghiệp vụ; BE schema lớn; Android; skin-only.
