# D13 — Biên nhận danh mục App Store Connect

Task #322 · Epic #301. Architecture impact: **Không** — metadata theo checklist đã duyệt.

Đã cập nhật App Information cho app `6823694490`: primary `ENTERTAINMENT`, secondary `BUSINESS`. Nguồn giá trị: `docs/asc/asc-fields-checklist.md` §3 tại SHA `2759b0a9a3e0ef30321e36367e4f10f6ca18ff4a` đã qua review độc lập PR308. API PATCH thành công và GET read-back khớp hai relationships; thời gian và mã HTTP trong [JSON allowlist](./D13-ASC-CATEGORIES-LIVE.json).

Apple primary: [Modify an app info](https://developer.apple.com/documentation/appstoreconnectapi/patch-v1-appinfos-_id_) và [relationships](https://developer.apple.com/documentation/appstoreconnectapi/appinfoupdaterequest/data-data.dictionary/relationships-data.dictionary).

App vẫn `PREPARE_FOR_SUBMISSION`; thao tác này không chọn build, không cập nhật age-rating questionnaire, Privacy Labels, agreements, giá hay territory, không submit/release. Chưa hoàn thành Task #322 hoặc gate publish. Receipt không chứa JWT, private key, credential hay user data.
