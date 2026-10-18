# D13 — ASC metadata live (Task #322, phần API)

Ngày 2026-10-18. Epic #301. Coordinator triển khai theo roadmap đã user duyệt.

## Nguồn và kiểm chứng

- Nội dung: exact reviewed BA SHA `2759b0a9a3e0ef30321e36367e4f10f6ca18ff4a`, PR #308; merge `24ac8d9e1cca7985dea17d85862b1395cade3e4c`, integrated CI 39107838496 SUCCESS.
- API signing local bằng credential ASC có sẵn trong env/keyfile; không đưa key/token/issuer vào file hoặc log.
- `GET` before → `PATCH/POST` các resource appInfoLocalizations/appStoreVersionLocalizations/appStoreVersions → `GET` read-back và assert nội dung bằng bản reviewed.
- Read-back: **Vemoki**, version **1.0.0**, hai locale **en-US / vi**, Privacy URL `https://vemoki.com/privacy`, Support URL `https://vemoki.com/support`, Marketing URL `https://vemoki.com`, releaseType **MANUAL**.
- Receipt allowlist + content hashes: [D13-ASC-METADATA-LIVE.json](./D13-ASC-METADATA-LIVE.json).
- Lần đầu Apple tự tạo counterpart localization khi thêm vi App Info, POST version localization theo snapshot cũ trả 409 DUPLICATE. Đã đọc lại live state, PATCH resource có sẵn và verify thành công. Không tạo app/version trùng. Backup trước thay đổi giữ local `/tmp/vemoki-d13-asc-metadata-attempt1.json`.

## Claim boundary / còn thiếu

State vẫn **PREPARE_FOR_SUBMISSION**. Chưa chọn build, chưa upload screenshot, chưa submit/release; không đổi Availability. Task #322 còn cần kiểm chứng các trường còn lại (Nutrition declarations, age questionnaire/content rights/categories theo source, review contact/demo credentials qua kênh bảo mật, UI snapshot nếu AC yêu cầu). Không claim task hoàn thành chỉ vì API phần listing đã lưu.

## Nguồn API Apple đối chiếu

- https://developer.apple.com/documentation/appstoreconnectapi/app-info-localizations
- https://developer.apple.com/documentation/appstoreconnectapi/app-store-version-localizations
- https://developer.apple.com/documentation/appstoreconnectapi/patch-v1-appstoreversions-_id_

## DoD

Implementer evidence; cần reviewer độc lập trên exact commit của PR chứa artifact này. Không chạy runtime tests cho docs-only artifact. SMTP/device/source final vẫn là gate trước submit.
