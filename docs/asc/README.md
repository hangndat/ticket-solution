# App Store Connect metadata (D13 refresh · reuse D10)

**Epic D13:** [#301](https://github.com/hangndat/ticket-solution/issues/301)  
**Reuse D10:** [#150](https://github.com/hangndat/ticket-solution/issues/150) · Stories [#151](https://github.com/hangndat/ticket-solution/issues/151) / [#157](https://github.com/hangndat/ticket-solution/issues/157)  
**App:** Vemoki · bundle `com.hangndat.ticket` · Team `BLUA62D52G`  
**Trạng thái gói docs:** draft sẵn sàng điền ASC / Chờ duyệt — **chưa submit** App Store; **chưa** chứng minh ASC UI đã điền.

## Artifacts

| File | Scope | Nội dung |
| --- | --- | --- |
| [listing-metadata.md](./listing-metadata.md) | D13 (#301) reuse D10 #152 | Copy listing VI/EN + keywords; Gate offline queue; version mismatch note |
| [asc-fields-checklist.md](./asc-fields-checklist.md) | D13 S3-T1 | Checklist field ASC (bundle / category / URLs / rating) |
| [privacy-nutrition.md](./privacy-nutrition.md) | D13 S1-T1/T2 | Privacy Nutrition Labels + SDK inventory + policy URL |
| [privacy-policy-draft.md](./privacy-policy-draft.md) | D13 S1-T1 | Bản draft privacy policy (canonical dài) |
| [app-review-notes.md](./app-review-notes.md) | D13 S3-T3 | App Review notes + tài khoản demo (O06) |
| [D13-BA-PRIVACY-ELIGIBILITY.md](../reviews/D13-BA-PRIVACY-ELIGIBILITY.md) | BA evidence | Exact SHA + Apple guideline URLs + findings mở |

## Ràng buộc

- **Cấm** claim “đã submit / đã live trên App Store” từ gói docs này.
- **Cấm** Expo/EAS Cloud Build; archive/TestFlight chỉ local Xcode (team `BLUA62D52G`).
- Không commit secret prod, API key ASC, `.p12`, provisioning thật.
- Credential demo cho reviewer: chỉ fixture/demo (xem [app-review-notes.md](./app-review-notes.md)); paste vào ASC UI khi review, không dùng làm prod secret.
- Evidence D10 **không** chứng minh Nutrition Labels / Review notes đã điền trên ASC.

## Việc còn lại trước submit (ngoài phạm vi BA docs này)

1. ~~Publish trang privacy~~ — `https://vemoki.com/privacy` **HTTP 200** (D12); tùy chọn làm giàu copy camera/deletion (S2-T3).  
2. Điền ASC Privacy Nutrition + fields + screenshot che secret (S3-T1).  
3. Screenshots / preview upload ASC (S3-T2).  
4. Archive local Distribution + TestFlight upload (S4 — không EAS Cloud).  
5. Sửa copy in-app account-deletion còn nói “O06 chưa chốt” (S5-T1 — `apps/mobile`, ngoài BA).  
6. Provision demo reviewer trên prod IdP — paste ASC only (S5-T2).  
7. Territory user chốt (đề xuất VN).  
