# D10 — App Store Connect metadata (prep)

**Epic:** [#150](https://github.com/hangndat/ticket-solution/issues/150)  
**Stories:** [#151](https://github.com/hangndat/ticket-solution/issues/151) (S1 listing), [#157](https://github.com/hangndat/ticket-solution/issues/157) (S3 privacy + review)  
**App:** Vemoki · bundle `com.hangndat.ticket` · Team `BLUA62D52G`  
**Trạng thái gói docs:** draft sẵn sàng điền ASC / Chờ duyệt — **chưa submit** App Store.

## Artifacts

| File | Issue | Nội dung |
| --- | --- | --- |
| [listing-metadata.md](./listing-metadata.md) | #152 | Copy listing VI/EN + keywords |
| [asc-fields-checklist.md](./asc-fields-checklist.md) | #153 | Checklist field ASC (bundle / category / URLs / rating) |
| [privacy-nutrition.md](./privacy-nutrition.md) | #158 | Privacy Nutrition Labels + policy URL |
| [privacy-policy-draft.md](./privacy-policy-draft.md) | #158 | Bản draft privacy policy (host trước submit) |
| [app-review-notes.md](./app-review-notes.md) | #159 | App Review notes + tài khoản demo |

## Ràng buộc

- **Cấm** claim “đã submit / đã live trên App Store” từ gói docs này.
- **Cấm** Expo/EAS Cloud Build; archive/TestFlight chỉ local Xcode (team `BLUA62D52G`).
- Không commit secret prod, API key ASC, `.p12`, provisioning thật.
- Credential demo cho reviewer: chỉ fixture/demo (xem [app-review-notes.md](./app-review-notes.md)); paste vào ASC UI khi review, không dùng làm prod secret.

## Việc còn lại trước submit (ngoài phạm vi S1+S3 docs)

1. Publish trang privacy policy công khai (URL trong checklist) — hiện `https://vemoki.com/privacy` chưa 200.
2. Screenshots / preview (Story S2 — Issues #154–#156 nếu có).
3. Archive local + TestFlight (Story archive — không EAS Cloud).
4. Pilot / D5 gates còn mở theo [RELEASE-CHECKLIST.md](../ops/RELEASE-CHECKLIST.md).
