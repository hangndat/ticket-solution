# Báo cáo Web E2E — 28/10/2026

Baseline `022cb80fd159dad2a7ebd0eeeea07fd64391f90a`; branch `hangndat/local-e2e-regression`. Chỉ sửa `tests/e2e/web/**`. Có 21 Playwright test trong bốn spec, ánh xạ đủ AUTH-01–08 và WEB-01–13; `coverage.json` phân biệt phần đã mã hóa với phần AC còn thiếu. `WEB-13` có hai test AUTO/MANUAL, dùng sự kiện và CSV riêng, thao tác Portal import/preview/commit/dispatch, worker Mailpit, claim, rồi Manager approve ở nhánh MANUAL. Không dùng auth mock hoặc `route.fulfill`.

## Kiểm tra đã chạy

| Lệnh                                                                                                                                                                           | Kết quả                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `pnpm exec playwright test -c tests/e2e/playwright.config.ts tests/e2e/web --list`                                                                                             | PASS: discovery 21 test/4 spec, không lỗi parse.                   |
| `pnpm exec tsc --noEmit --module nodenext --moduleResolution nodenext --target es2022 --types node --typeRoots apps/web/node_modules/@types --skipLibCheck tests/e2e/web/*.ts` | PASS: không có lỗi type.                                           |
| `pnpm exec prettier --check tests/e2e/web/*.ts tests/e2e/web/coverage.json tests/e2e/web/FIXTURES.md tests/e2e/web/REPORT.md`                                                  | PASS.                                                              |
| `E2E_MANIFEST`                                                                                                                                                                 | Phiên worker này chưa chạy browser/HTTP/runtime cho bản chỉnh sửa. |

CRG checkout hiện tại đã build và search, `built_at_sha` khớp baseline `022cb80f`; selector và route vẫn đối chiếu bằng source hiện tại.

Coordinator báo smoke `mvs7d4db-259457`: WEB-02/04/07/08 PASS, AUTH-01 FAIL vì OIDC `nonce` null. Smoke `mvs7goky-950046`: AUTH-03/05 PASS sau chỉnh sửa của root; WEB-13 còn chạy lúc bàn giao worker. Các kết quả này thuộc bản test trước chỉnh sửa ở phiên này; chưa xác nhận bản mới bằng runtime.

## Hành vi đã mã hóa

- AUTH: login attendee qua Keycloak và BFF `/me`, cookie secure/HttpOnly, sai mật khẩu/state, guest/unverified gate, Web logout, refresh token TTL ngắn, attendee không mang Portal identity, đổi actor không mở được vé cũ, account consent và ACK một POST.
- WEB: published trên catalog/detail, draft không công khai, private/unlisted chỉ có direct link; auto redeem → wallet/QR/reload; event redeem và global entry; invalid code không cấp vé; terms required; manual pending chưa có vé; double submit một vé; worker → Mailpit TicketIssued với link/QR; owner isolation; viewport 390px; marketing VI/EN và legal/demo links; WEB-13 như trên.
- Mutation assertion dùng fixture code/account riêng theo ID; WEB-13 tách AUTO/MANUAL bằng event/CSV riêng. Mailpit polling có timeout, không sleep cố định; link token chỉ giữ trong test process.

## Blocker và drift cần đối soát khi chạy

1. Harness chưa cung cấp `E2E_MANIFEST`, TLS/run resources/seed, nên chưa có kết quả chạy UI, API hoặc worker. Fixture keys đầy đủ tại `FIXTURES.md`; đặc biệt WEB-13 cần `manualEventId`, `manualEventSlug`, `manualTicketTypeId`, `manualTicketTypeLabel`, hai CSV và account riêng. AUTH-08 phải dùng actor fresh vì request có thể revoke session.
2. Source `apps/web/src/oidc/authorize.ts` tạo `state` và PKCE nhưng không đặt `nonce`; AUTH-01 assert nonce theo PLAN. Smoke `mvs7d4db-259457` xác nhận `nonce` null, là **product FAIL**. Không sửa product trong scope này.
3. Source `apps/web/app/(consumer)/redeem/page.tsx` tạo `loginHref('/redeem')` khi URL có `tenantSlug/eventSlug`, nên context từ trang event có nguy cơ mất sau login. WEB-03 assert giữ slug theo PLAN; cần chạy để xác nhận.
4. WEB-10 cần fault control scoped theo run cho public API, wallet và redeem; không thay bằng route mock. AUTH-05/06/08 và WEB-04/05/06/07/09/12/13 còn những negative, recovery hoặc DB/operation/outbox assertions ghi chi tiết trong `coverage.json`. Không đánh dấu nhóm đó complete.
5. WEB-13 Portal selectors dựa trên `app/t/[tenantId]/e/[eventId]/guests/page.tsx` và `src/ops/panels/import-invitations-panel.tsx` hiện hành; phải revalidate sau khi harness provision dữ liệu. Import job và Mailpit được poll theo kết quả thật; không suy từ trạng thái SMTP `ACCEPTED` là người nhận đã đọc.
6. AUTH-08 hiện assert consent disable/enable, đúng một browser POST, HTTP ACK `200/201/202` với `requestId` và `REQUESTED`, rồi UI ACK không hứa xóa ngay. Nếu API gate từ chối sau request, test sẽ fail tại HTTP status; không chuyển sang success giả. Thiếu DB one-open-request và revoke/job evidence.
7. WEB-01 theo PRD M03: private/unlisted không vào catalog nhưng direct link phải hiển thị event đã publish. Source `loadPublishedEventDetail` hiện chỉ nhận `PUBLIC`, nên assertion mới có thể FAIL sản phẩm; không sửa product trong slice test.
8. WEB-13 smoke `mvs7goky-950046` AUTO timeout khi AntD `option` hidden; snapshot thấy dropdown option hiển thị ở portal. Test nay chọn `.ant-select-dropdown:visible .ant-select-item-option-content` và cleanup bằng `Promise.allSettled` để lỗi đóng context không che lỗi gốc; chưa chạy lại runtime để xác nhận.

`coverage.json`: 1 nhóm `implemented` ở mức test code (WEB-08), 20 nhóm `blocked` do còn AC phụ hoặc cần control/fixture. `implemented` không đồng nghĩa runtime PASS.
