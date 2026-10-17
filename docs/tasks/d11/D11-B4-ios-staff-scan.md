# Spec đề xuất — D11-B4-ios-staff-scan (S-P0-B)

> **CHƯA APPROVED** coding. Parent [`D11-B4-gate-staff-ux.md`](./D11-B4-gate-staff-ux.md) = TEMPLATE.  
> **Một Issue / một Dispatch / `ios` only.** Wave P0 khuyên slot ios.

## Vai trò chuyên môn

- Role ID: `ios` · File: `docs/agents/roles/ios.md` · Agent: cursor  
- Trước code: expo-overview + RN best practices  
- Check-in: ± `reviewer-security`  
- Team `BLUA62D52G`; **cấm** EAS Cloud Build

## Mục tiêu

Scanner offline queue clarity (BA S-P0-B): UI phân biệt đã xếp hàng / đã áp dụng / xung đột; retry không tạo check-in trùng (O05/ADR-18).

## Phụ thuộc

- ADR-18 có sẵn — **không** invent sync API
- Soft: PD Gate states + prototype `staff-scan.html` (đã có trên disk)
- Soft: BA S-P0-B AC
- S-P1-C validate-only: **không** gộp vào Task này trừ khi user tách Issue riêng

## Ownership

`apps/mobile` — staff scan / supervisor screens only.

## AC

- [ ] States: online / offline / pending sync / conflict / denied / already checked-in
- [ ] Copy VI; không lộ jargon nội bộ
- [ ] `scripts/sim-uat.sh` artifacts + exact SHA
- [ ] Không phá invariant check-in (tests hiện có vẫn PASS)
- [ ] `reviewer-dod` exact-SHA

## Proof limits

Simulator ≠ device UAT; prototype ≠ QA pass.

## OUT

Web `/gate`; BE contract mới; Android; EAS Cloud.
