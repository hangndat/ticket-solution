# Spec đề xuất — D11-B3 Attendee journeys (iOS)

> **CHƯA APPROVED.** Một ownership `ios` / Dispatch — chọn surface (events/redeem/claim/…) trong Issue; không trộn web.

## Vai trò chuyên môn

- Role ID: `ios` · File: `docs/agents/roles/ios.md` · Agent: cursor
- Trước code/review mobile: đọc skill expo-overview + RN best practices

## Mục tiêu (hypothesis)

Events / redeem / claim / ví / ticket QR / push status — depth production theo PD; giữ offline display; Team `BLUA62D52G`; **cấm** EAS Cloud Build.  
Brand-test multi-tenant (S-P0-C): gắn [`D11-S-P0-C-brand-test-ac.md`](./D11-S-P0-C-brand-test-ac.md) khi surface event chrome trong scope.

## Phụ thuộc

- Soft: PD handoff attendee iOS  
- ∥ B2 web (khác ownership)  
- Push DELIVERED: tái dùng evidence D5; không claim lại trừ regression  
- Contract change → escalate (**không** auto-approve)

## Ownership

`apps/mobile` only.

## AC khung

- [ ] States PD trên màn trong scope  
- [ ] Brand-test AC (S-P0-C) nếu surface event trong scope — ≥2 tenant trên iOS theo checklist  
- [ ] `scripts/sim-uat.sh` artifacts  
- [ ] Local prebuild/xcodebuild nếu Task yêu cầu binary — không EAS Cloud  
- [ ] `reviewer-dod` exact SHA

## Proof limits

Simulator ≠ device UAT; ≠ store submit; prototype headless QA ≠ runtime/app QA.
