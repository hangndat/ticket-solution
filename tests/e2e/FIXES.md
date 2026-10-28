# Sửa failures — yêu cầu user 2026-10-28

Phạm vi: sửa nguyên nhân 8 browser failure của run `mvs8dgyy-e56379` và metric PostgreSQL còn fail, giữ acceptance và bảo mật. Lượt sửa product **2/2** cho F02 đã xong; các lượt trước khi sửa product là xây test/harness. James đã review DoD/security PASS trên SHA `cffc5d69`; sau tích hợp main, full browser 42/42 PASS ở `mvse0ao9-872b62`; revalidation exact SHA tích hợp còn chờ.

| ID | Finding / owner | Điều kiện đóng | Trạng thái |
| --- | --- | --- | --- |
| F01 | AUTH-01 nonce / Linh | Nonce được sinh/lưu/verify, AUTH-01 browser + negative nonce regression PASS | Browser PASS `mvscrri7-7395a2`; chờ review |
| F02 | AUTH-07 account switch / Linh | Hai attendee đăng nhập cùng context sau logout; BFF identity đúng và không đọc vé người trước | Targeted race và full browser PASS `mvsdgi6z-fde3cd`; lượt sửa 2/2, chờ review rủi ro refresh response đến muộn |
| F03 | PORT-03 clone / Enton | Parse nested event, clone UI điều hướng đúng, inventory/ticket không sao chép | Browser PASS `mvscrri7-7395a2`; chờ review |
| F04 | WEB-01 private direct link / Gonic | PUBLIC/UNLISTED detail, catalog PUBLIC-only, draft/tenant suspend vẫn deny | PG và browser PASS `mvscrri7-7395a2`; chờ review |
| F05 | WEB-03 context / Minh | Scope tenant/event giữ qua login; không đưa raw code/token vào return URL | Unit và browser PASS `mvscrri7-7395a2`; chờ review |
| F06 | WEB-13 AUTO/MANUAL / Enton | Dispatch preview 200/201 được parse; toàn hành trình import→worker→Mailpit→claim/approve PASS | AUTO/MANUAL browser PASS `mvscx4y6-06bb4f` sau wait approve response; chờ review |
| F07 | WEB-07 CSRF / Minh | Cold mutation bootstrap cookie; chỉ retry CSRF rejection trước mutation, không replay unknown/forbidden; browser PASS | Unit và browser PASS `mvscrri7-7395a2`; chờ review |
| F08 | POL-01 slaOverdue / Gonic | Count đúng dưới runtime RLS; không cấp row access xuyên actor | Full D 38/38 và POL-01 PG PASS sau migration; chờ review security |

Security: Có — OIDC/session, CSRF, public projection, RLS aggregate và mutation confirmation. Một reviewer độc lập gộp correctness/security sau integration; không có gate deploy/publish trong scope local này. ADR-19 được làm rõ catalog/direct-link theo PRD M03 và yêu cầu sửa failures đã duyệt.
