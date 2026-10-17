# Spec đề xuất — D11-B1 Privacy / retention UX

> **CHƯA APPROVED.** Chỉ `worker-start` sau user review roadmap + Issue thật.

## Vai trò chuyên môn (bổ sung)

- Role ID: `web` (primary); copy/surface iOS → Role `ios` Task riêng nếu tách PR
- File: `docs/agents/roles/web.md` (+ `ios.md` nếu có)
- Agent: cursor

## Mục tiêu (map BA S-P0-D)

Đóng gap `GET https://vemoki.com/privacy` → **404** (quan sát tươi 18/10 + D10). Account deletion / retention messaging chỉ khi có **policy đã duyệt**.

## Phụ thuộc thật

- **Hard trước publish production:** nội dung privacy **đã được user/legal duyệt** (không ship “policy TBD” lên public)
- **Hard trước PII thật:** O06 chốt số ngày/region/SLA (DECISION-LOG)
- Soft: PD account/privacy states; BA S-P0-D AC
- Deploy URL live: **ủy quyền riêng** — merge PR ≠ prod live; source SHA ≠ deploy SHA

## Ownership

- `apps/web` only cho route/page (một Dispatch web)
- ASC/store prep: Task coordinator/docs riêng — **không** trộn ownership
- Không: Android/Wallet; không tự submit store

## AC (khung — BA/PD chỉnh)

- [ ] Bản nháp privacy có thể nằm docs/local cho review
- [ ] Public `/privacy` = 200 **chỉ sau** duyệt nội dung + ủy quyền deploy
- [ ] Copy không chứa số retention bịa khi O06 còn mở
- [ ] Account deletion states VI (PD)
- [ ] Headless UAT + exact SHA + `reviewer-dod` (± `reviewer-security` nếu PII/session)

## Proof limits

≠ pilot ready; O06 mở → không ingest user thật; prep ≠ store submit.
