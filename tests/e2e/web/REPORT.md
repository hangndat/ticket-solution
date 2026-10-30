# Báo cáo Web E2E — 28/10/2026

## WEB-08 ticket email Mailpit B/H/R — 30/10/2026

- Trước: run mvuruy41 chứng minh issue + Mailpit link trùng ticketId; thiếu wallet, subject/event body, guest authz selector đúng DOM, owner URL/QR sau mở link. Sau: `redeem.spec.ts › [WEB-08]` + `assertTicketIssuedMail` / `assertTicketQrInlineAttachment` trong `mailpit.ts` — wallet sau redeem, Mailpit poll theo recipient + `eventName`, raw MIME `image/png` inline `ticket-qr@vemoki` (bytes PNG thật, không chỉ `cid:` trong HTML); guest context → `owner-ticket-need-login-state`, không QR/id; `otherAttendee` context riêng + Keycloak → cùng URL email → không QR/id, BFF detail 403/404 không lộ ticketId, UI `forbidden`/`missing`/`tenant-unresolved`; owner đã login → URL vé, QR figure, `owner-ticket-id` title; PG `assertIssuedExactlyOnce` giữ lớp H.
- Checkout sạch SHA `52f0b5fac88c779cae5e79482f4ff0a3d08a9719` (`evidenceExactShaEligible: true`): `node tests/e2e/harness/run.mjs e2e --case=WEB-08 --skip-build` → run `mvuyx9i1-a53085` PASS 1/1 browser; artifact `tests/e2e/.artifacts/mvuyx9i1-a53085/summary.json`. `pnpm test:e2e:guards` 18/18 trên cùng SHA. Worker + SMTP Mailpit thật của run; không mock auth/mail. Giới hạn: Mailpit API ≠ inbox internet; không assert delivery/read receipt ngoài sink run.
- Fix iter 2/2 (WEB08-DOD-02): `mailpit-mime.mjs` tách MIME theo boundary, một part phải có đủ CID ticket-qr, image/png, base64; guard regression từ chối CID/PNG lệch part.
- `coverage.json` WEB-08 → `covered`; Relates #1037. Không sửa `apps/web` / API / worker runtime.

## WEB-02/WEB-03 redeem B+H — 30/10/2026

- Đối chiếu PLAN §5.2 P0: WEB-02 (verified AUTO, form/terms, wallet/QR/reload, PG code/request/ticket/operation/outbox/quota +1) và WEB-03 (context event + global qua login, invalid/ambiguous privacy, PG không issue thêm, cleanup collision) đã khớp `redeem.spec.ts` — không thiếu assertion bắt buộc, không sửa harness/fixture ngoài tài liệu.
- Checkout sạch SHA `96339b10a215febb0dac49ae017b71641f5f01a5` (`evidenceExactShaEligible: true`): `node tests/e2e/harness/run.mjs e2e --case=WEB-02,WEB-03` (build production) → run `mvuxsq31-d9f462` PASS 3/3 browser; artifact `tests/e2e/.artifacts/mvuxsq31-d9f462/summary.json`. `pnpm test:e2e:guards` 16/16. Locale VI, Keycloak thật, viewport desktop harness mặc định; không fake auth.
- `coverage.json` WEB-02/WEB-03 → `covered` theo run trên; Issue #1037.

## WEB-10 fault/recovery B+H — 30/10/2026

- Trước: `coverage.json` ghi `implemented` theo code F03/F05 nhưng chưa có exact-SHA run trên base branch. Sau: đối chiếu PLAN §5.2 P0 B/H với sáu test `fault.spec.ts › [WEB-10]` — catalog/detail/wallet/redeem, fault control `runtime.faultControlPath`, không sửa `apps/web`.
- Hành vi: detail/catalog/wallet phân biệt unreachable vs empty thật vs recovery; redeem timeout không vé giả; unavailable không commit; lostResponse poll success; delayed commit + operation404 + retry cùng key, PG một vé/operation. Locale VI, actor attendee WEB-10, desktop (harness mặc định).
- Checkout sạch SHA `85ddecddb8f2128bdcbed60b94c56fc416fc89af` (`evidenceExactShaEligible: true`): `node tests/e2e/harness/run.mjs e2e --case=WEB-10` → run `mvux2lwy-e9069f` PASS 6/6 browser; artifact `tests/e2e/.artifacts/mvux2lwy-e9069f/summary.json`. `pnpm test:e2e:guards` 16/16. Giới hạn: không assert cold-offline; MANUAL pending thuộc WEB-06.

## WEB-07 idempotent redemption B+H — 30/10/2026

- `redeem.spec.ts › [WEB-07]`: double-click một vé; mất response sau commit BFF thật rồi UI poll tới success; reload/resubmit cùng mã → panel `used`, wallet không tăng; cùng `idempotencyKey` đổi `answers` → BFF `409` `IDEMPOTENCY_CONFLICT`; hai POST BFF đồng thời cùng mã, key khác → `201`/`409` `CODE_CONSUMED`. Mỗi nhánh đối soát PostgreSQL qua `assertIssuedExactlyOnce` (một request ISSUED, ticket ACTIVE, một operation COMPLETED, một TicketIssued outbox, quota +1/bucket); race không có barrier lock — giới hạn ghi trong `coverage.json`.
- Checkout sạch SHA `7e8cce2dee502cb12163d2b384012952bfd6ac45` (`evidenceExactShaEligible: true`): `node tests/e2e/harness/run.mjs e2e --case=WEB-07` (build production) → run `mvuw3xnz-3dad02` PASS 5/5 browser; artifact `tests/e2e/.artifacts/mvuw3xnz-3dad02/summary.json`. `pnpm test:e2e:guards` 16/16 trên cùng SHA. Không sửa `apps/web` runtime trong dispatch này.

## WEB-05 tích hợp — 30/10/2026

- Rebase lên `main`, giữ đủ worklog append-only. Checkout sạch SHA `42a29788b252d4f17937c0401187512b1e7b47ea`: browser `mvuvgow7-f39e4e` PASS 7/7, HTTP `mvuvhn2t-f1e3ab` PASS; cả hai `evidenceExactShaEligible: true`. CI PR #1071 run `41046526455` SUCCESS, mergeable.
- James revalidate F01/F02 và DoD PASS tại https://github.com/hangndat/ticket-solution/pull/1071#issuecomment-6521341187. Bản ghi coverage chuyển `covered`; commit này chỉ cập nhật tài liệu.

## WEB-05 form/terms validation B+H — 30/10/2026 (James F01/F02 lượt 1/2)

- F01: Tách ma trận B/H — mỗi nhánh invalid (required/type/select allowlist/termsAccepted=false/forged schema, stale form/terms) assert status+code riêng; PG `assertWeb05BusinessUnchanged` (browser) và `web04AssertRejected` + `redemption_requests`/quota (HTTP) không đổi request/ticket/code/quota.
- F02: `web05-published-config.mjs` + `web05-hashes.mjs` — consent hash trên PG khớp nguồn published v1/v2 (`hashFormDefinition`/`hashTermsContent` body), `assert.notEqual` v2↔v1; HTTP redeem v1 trên `secondCode` trước publish v2, redeem v2 trên `primary` sau publish.
- Run thăm dò dirty trên HEAD cũ: browser `mvuv8zmi-a02db4` PASS 7/7; HTTP `mvuv9phi-457559` PASS; `pnpm test:e2e:guards` 16/16. Evidence exact SHA ghi sau commit sạch. `coverage.json` giữ **blocked** chờ James revalidate.
- Checkout sạch SHA `b6f9856b5e7b013278e1a9e66a61f6eb00fa3ed0` (`evidenceExactShaEligible: true`): `node tests/e2e/harness/run.mjs e2e --case=WEB-05 --skip-build` → `mvuvanf0-3fc114` PASS 7/7; `pnpm test:e2e:http --case=WEB-05 --skip-build` → `mvuvba97-1446eb` PASS; `pnpm test:e2e:guards` 16/16.

## WEB-05 form/terms validation B+H — 30/10/2026

- Mở rộng `redeem.spec.ts › [WEB-05]`: client gate terms/required/type (email/phone/checkbox) không POST; BFF `postRedeemDirect` từ chối `FORM_INVALID`, `FORM_VERSION_STALE`, `TERMS_VERSION_STALE` với `assertRedemptionStateUnchanged`; redeem thành công trên `secondCode` đối soát `form_version`/`terms_version` + hash trên `redemption_requests`.
- HTTP `live.test.mjs#[WEB-05]`: cùng ma trận lỗi qua API Keycloak bearer; owner publish config v2 trong run, client không tự chấp nhận v1; redeem v2 lưu consent PG.
- Seed WEB-05: `formVersion`/`termsVersion`/`controlDatabaseUrl`/`codeIds.primary+secondary`. Checkout sạch SHA `85754809a63dc90cc6baffcca5382805f52aa07d` (`evidenceExactShaEligible: true`): `node tests/e2e/harness/run.mjs e2e --case=WEB-05 --skip-build` → `mvuuuf0j-5208aa` PASS 4/4; `pnpm test:e2e:http --case=WEB-05 --skip-build` → `mvuuv3my-d98585` PASS; `pnpm test:e2e:guards` 16/16.

## WEB-11 responsive B — 30/10/2026

- F01 fix `public.spec.ts › [WEB-11]`: desktop 1280×720 redeem `secondCode` submit (BFF 201) → wallet link → wallet-ticket CTA → QR; mobile 390×844 lặp nav/sheet, submit cùng mã → panel `used`, mở vé qua wallet CTA (vé vừa phát hành); không `page.goto` thẳng URL vé; giữ Keycloak/fixture PLAN B.
- Run targeted sau sửa (working tree dirty): `node tests/e2e/harness/run.mjs e2e --case=WEB-11 --skip-build` → `mvuu0by7-149fc3` PASS 1/1; `pnpm test:e2e:guards` 16/16. Evidence exact SHA ghi sau commit sạch.
- Checkout sạch SHA `c5af5f1df2653ff9e490eb23dba1f00370a32557` (`evidenceExactShaEligible: true`): `node tests/e2e/harness/run.mjs e2e --case=WEB-11 --skip-build` → `mvuu1bx0-e34021` PASS 1/1; `pnpm test:e2e:guards` 16/16.
- `coverage.json` WEB-11 → `implemented` theo PLAN §5.2 P1 B; không sửa `apps/web`.

## WEB-11 responsive B — 30/10/2026 (trước F01)

- Mở rộng `public.spec.ts › [WEB-11]`: desktop 1280×720 và mobile 390×844 trên cùng phiên Keycloak thật; nav desktop, sheet menu + Escape, wallet, event/redeem form (field + terms), primary CTA trong viewport, ticket QR; helper `assertNoHorizontalOverflow` / `assertPrimaryButtonOperable`.
- Run targeted trên base `fdca450699d8fb34698a59f3d355f352fa7387cf`: `node tests/e2e/harness/run.mjs e2e --case=WEB-11 --skip-build` → `mvutn150-55c16a` PASS 1/1; `pnpm test:e2e:guards` 16/16. Trước commit working tree dirty nên `evidenceExactShaEligible=false`; cần recheck trên SHA sạch sau commit.
- `coverage.json` WEB-11 → `implemented` theo PLAN §5.2 P1 B; không sửa `apps/web`.

## WEB-13 invitation claim — 30/10/2026

- Bổ sung E2E: replay cùng `idempotencyKey` sau AUTO (ticketId giữ nguyên, `replayed`, PG không mutation thêm), ma trận token `INVITATION_EXPIRED` / `INVITATION_REVOKED` (run-scoped PG control), đối soát `quota_buckets` cho AUTO claim (+1), MANUAL pending (0), manager approve (+1), reject (snapshot pending không đổi ticket/quota/outbox).
- Run sạch sau commit: `node tests/e2e/harness/run.mjs e2e --case=WEB-13 --skip-build` → `mvust3vn-4cb024` PASS 9/9 browser; `pnpm test:e2e:guards` 16/16. Seed thêm slot `idempotencyReplay` và `revoked` trên harness WEB-13.
- `coverage.json` WEB-13 → `implemented` theo PLAN §5.2 P0 B/H/R; không sửa apps/web runtime.

## AUTH-07 Web ADR-23 — 30/10/2026

- Web `/wallet` và `/t/{slug}/tickets/{id}` trả shell không chứa vé trong HTML/RSC. Browser lấy identity rồi BFF JSON; callback tạo epoch mới, logout xoay epoch, refresh giữ nguyên. BFF private gắn actor/epoch/surface; client kiểm binding, marker và generation trước khi hiển thị. Chặn prefetch RSC của hai route này.
- Chromium desktop 1280×720: actor A mở wallet/detail thấy vé; sau logout và actor B login cùng context, detail BFF trả 403/404, wallet không còn vé A; back, reload, mở URL ở tab mới vẫn không hiện vé A. Document wallet/detail và identity/BFF trả `private, no-store`; raw HTML không có card vé. Browser mobile 390×844: giữ document detail A đã fetch, login B rồi thả response; shell không có vé A và DOM không commit `owner-ticket-ready`.
- Cùng `sub` login lại tạo epoch khác: giữ JSON vé A rồi thả sau callback mới, sentinel `STALE_ONLY` không từng xuất hiện trong DOM; lần fetch mới có thể hiển thị vé hợp lệ. Refresh cũ trả muộn sau logout không đổi cặp epoch của logout. Marker chỉ là nonce, cookie snapshot còn lại HttpOnly; token không vào JS storage.
- Probe Keycloak + PostgreSQL cô lập `pnpm test:e2e --case=AUTH-07`: run `mvuidsib-cfab12` và recheck `mvuifriu-b30407` (sau khi thêm tab thứ hai đang mở detail), 3/3 browser test PASS; working tree dirty nên `evidenceExactShaEligible=false`. Cần run lại trên SHA sạch sau commit. Portal và API acceptance đầy đủ vẫn do owner tương ứng xác minh; không gán full AUTH-07 PASS từ kết quả Web này.

## AUTH-06/07 F04 — 30/10/2026

- Baseline sạch `4a04a5920e57b9498b0f61d4de4937d0af6e2d38`, `pnpm test:e2e:smoke --case=AUTH-06,AUTH-07`: run `mvuh242s-c77639` PASS. `pnpm test:e2e:http --case=AUTH-06`: run `mvuh5it9-77aece` PASS, trên working tree chỉ có test mới (H code không đổi); HTTP dùng Keycloak thật và xác nhận revoke membership, event assignment, staff session chặn mutation sau đó, check-in success count không tăng.
- AUTH-06 B: attendee không nhận Portal subject; Web redeem sau clear session không báo success, wallet không hiện vé. **BLOCKED full AC**: Portal gate/check-in UI false-success nằm ngoài slice Web; self-expiry Web UI chưa có shortWeb fixture cho AUTH-06. Không gán H PASS cho hai phần này.
- AUTH-07 diagnostic `mvuh3r4k-fc5f15` FAIL: response HTML vé của actor A đã được fetch và giữ tại Playwright barrier; sau Keycloak login actor B cùng context và BFF ticket GET 403/404, thả response cũ vẫn render `owner-ticket-ready` của A. Đây là lỗi quan sát UI, không phải race chỉ suy từ cookie. Giữ reproducer với `test.fail` (vẫn chạy, CI kỳ vọng failure) và **BLOCKED full AC**; coordinator đã nhận gap và quyết định contract/ADR riêng trước Web runtime fix. Test còn đối soát back/reload/mở lại URL, wallet, HTTP list/detail và `no-store` cho HTML/BFF; admin data thuộc Portal ngoài scope.
- Run thăm dò trên working tree dirty không là exact-SHA evidence. Cần targeted clean-SHA run sau commit; không dùng trạng thái PASS của runner khi `test.fail` để báo AUTH-07 PASS.

## AUTH-02 issuer phụ — 30/10/2026

- Run thăm dò `mvue1iq9-ca9616` với `pnpm test:e2e:smoke --case=AUTH-01,AUTH-02,AUTH-05` PASS 12/12 browser. `summary.json` ghi `gitCommit=15ba60e722fe40882782f957766f65fb0d0e8f46`, `workingTreeDirty=true`, `evidenceExactShaEligible=false`; đây không phải evidence trên commit đó. Preflight xác minh token Keycloak thật của realm chính và realm phụ qua JWKS/issuer/audience tương ứng trước khi browser chạy.
- Test mới AUTH-02 lấy token thật từ `manifest.runtime.secondaryIssuer`/`secondaryHttpClientId`/`secondaryHttpClientSecret` với `manifest.secondaryActor`, xác nhận `iss` khác realm chính và `aud` chứa `ticket-api`. Sau login primary attendee, test bỏ refresh cookie primary để một lần refresh hợp lệ không che kết quả, thay access/subject cookies bằng token phụ: BFF `/api/bff/me` trả 401, không lộ user ID/subject/token; cookie phiên bị xóa; `/wallet` chuyển về `wallet-need-login`, không còn grid của actor cũ. Không mock JWT.
- AUTH-01 **PASS** theo bốn browser test: attendee đúng client/callback/PKCE/state/nonce, `/me` đúng actor, return path allowlist, không login loop; staff owner/manager bounce sang Portal với client/callback/cookies riêng. AUTH-02 **PASS** theo sáu browser test: sai mật khẩu, callback thiếu/sai state, code bị IdP từ chối phân biệt lỗi local/upstream, audience sai, issuer sai, token hết hạn đều không cấp phiên hợp lệ. Realm phụ có signing key khác, nên kết quả từ chối chứng minh fail-closed với token issuer khác nhưng không cô lập check `iss` khỏi JWKS/signature; không quy kết verifier từ chối bởi một nguyên nhân nội bộ duy nhất.
- Cần gắn bằng chứng clean checkout SHA cuối ở PR/Issue sau commit và run lại; không dùng run thăm dò dirty để tuyên bố exact-SHA PASS.

## Bổ sung AUTH-01 staff/Portal bounce + audit AUTH-02 issuer — 30/10/2026

SHA `d34389bda71afd6b393d2784952dda3aad24ec82` (checkout sạch, `evidenceExactShaEligible: true`). Run `node tests/e2e/harness/run.mjs smoke --case=AUTH-01,AUTH-02,AUTH-05` (build đầy đủ, không `--skip-build`) → `mvud61d3-11a635` PASS 11/11 browser, dùng Keycloak/PostgreSQL/API/Worker thật.

- **Gap PORTAL_ORIGIN đã nêu ở bản trước (SHA 334b75ed) là nhận định sai**, không phải gap thật: `processEnvironment` (`tests/e2e/harness/runtime.mjs:741`) đặt `PORTAL_ORIGIN: state.origins.portal` vào `common`; `run.mjs` (`:222` gọi `processEnvironment`, `:287-302` `clientEnv()` spread `...common`) truyền env đó vào cả process `web` và `portal`. Không cần coordinator sửa harness.
- **AUTH-01 staff bounce (mới)**: test `staff (owner/manager) OIDC login bounces to Portal with its own client/callback and host-only cookies (ADR-20)` đăng nhập lần lượt `owner` và `manager` (fixture `AUTH-01` thật, có event assignment qua seed, không dùng tài khoản global không membership) qua Web `/api/auth/login`; xác nhận Web callback quyết định nhánh staff và chỉ redirect phẳng tới `${PORTAL_ORIGIN}/api/auth/login` (không copy BFF session, đúng ADR-20 §3); Portal tự chạy Authorization Code + PKCE S256 + state + nonce riêng cho `client_id=ticket-admin-web`, `redirect_uri` đúng origin Portal; `/api/bff/me/subject` trên Portal trả 200 và khớp `sub`/`email` thật trong `oidc_id_token` của actor (không so với Postgres `userId` — hai id khác nhau theo `upsertFromVerifiedIdentity`, đã sửa sau lần chạy đầu FAIL vì so nhầm); cookie cả hai surface host-only (không `Domain=.vemoki.com`). Với test này, AUTH-01 PASS đủ attendee + staff theo client/callback/PKCE/state/nonce/cookie boundary; `coverage.json` AUTH-01 chuyển `implemented`.
- **AUTH-02 wrong issuer — audit, giữ BLOCKED**: đọc `tests/e2e/harness/runtime.mjs` (`realmConfig`) — mỗi run chỉ dựng đúng một realm Keycloak `e2e-<runId>`, một issuer `${origins.auth}/realms/${realm}`; không có client/mapper nào phát `iss` khác. Không sửa harness/backend trong dispatch này theo chỉ đạo. Đề xuất tối thiểu cho coordinator (chưa thực hiện): thêm client E2E-only trong CÙNG realm với `oidc-hardcoded-claim-mapper` override `iss` — cùng mẫu đã dùng cho claim `acr` hardcode trên `ticket-platform-web` (`runtime.mjs` dòng ~298-315) — rẻ hơn dựng realm Keycloak thứ hai hoặc DB phụ. Vẫn BLOCKED chờ coordinator quyết định.
- Kiểm tra khác chạy lại trên source mới: `pnpm exec tsc --noEmit --module nodenext --moduleResolution nodenext --target es2022 --types node --typeRoots apps/web/node_modules/@types --skipLibCheck tests/e2e/web/*.ts` PASS; `pnpm exec prettier --check tests/e2e/web/*.ts tests/e2e/web/coverage.json` PASS; `pnpm exec playwright test -c tests/e2e/playwright.config.ts tests/e2e/web --list` PASS discovery 48 test/5 spec; `pnpm test:e2e:guards` PASS 16/16.
- Không sửa `apps/web`, `apps/portal`, backend, worker, mobile hoặc harness trong dispatch này; chỉ `tests/e2e/web/auth.spec.ts`, `tests/e2e/web/coverage.json`, `tests/e2e/web/REPORT.md`.

## Bổ sung AUTH-01/02 — 30/10/2026

SHA `334b75edb38519e9977954cc69362e77bea569b6` (checkout sạch, `evidenceExactShaEligible: true`). Run `node tests/e2e/harness/run.mjs smoke --case=AUTH-01,AUTH-02,AUTH-05` (build đầy đủ, không `--skip-build`) → `mvucm4cv-883003` PASS 10/10 browser, dùng Keycloak/PostgreSQL/API/Worker thật, không mock auth.

- **AUTH-01**: 3 test PASS — `attendee OIDC callback and BFF identity` (giữ nguyên, xác nhận lại PKCE/state/nonce và BFF `/me` đúng actor); thêm `disallowed return path falls back to the default instead of an open redirect` (return path ngoài allowlist `sanitizePostLoginPath` rơi về `/`, không open redirect); thêm `post-login navigation is terminal and does not bounce back to login` (reload `/wallet` sau login giữ `wallet-ready`, không bounce lại `/auth`, `/api/bff/me` 200 — không login loop). Gap đã nêu ở `coverage.json`: nonce-null FAIL cũ (smoke `mvs7d4db-259457`) không tái hiện trên source hiện tại — `apps/web/src/oidc/authorize.ts`, `pkce.ts`, `app/api/auth/login/route.ts` đã sinh và gắn `nonce` thật, test browser xác nhận `nonce`/`state` không rỗng và login thành công. Staff client/callback (bounce ADR-20 sang Portal) vẫn BLOCKED: `run.mjs` không set `PORTAL_ORIGIN` cho process `apps/web`, nên `decideTicketWebPostLogin` luôn nhận `portalOrigin=null` và không bao giờ trả nhánh `'portal'` — không có cách quan sát hành vi bounce thật từ slice web; cần coordinator thêm env này vào harness (ngoài scope `tests/e2e/web`/`apps/web`) trước khi đóng AUTH-01 đầy đủ attendee+staff.
- **AUTH-02**: 5 test PASS — giữ `wrong password and callback without state do not create a session` (cũ); thêm `mismatched callback state is rejected locally and never reaches the IdP token exchange` (state giả mạo → redirect `/auth?error=invalid_state` trước khi gọi Keycloak, không session); thêm `IdP-rejected authorization code is a distinct upstream error, not the local state/validation error` (state thật nhưng `code` rác → Keycloak token endpoint trả lỗi, callback redirect với `error` khác `invalid_state` — phân biệt lỗi cục bộ và lỗi IdP/upstream thật, không chỉ giả định); thêm `a correctly-signed token for the wrong audience does not grant a valid BFF session` (mint access token thật qua `e2e-http-platform` + `operator` TOTP cùng realm run, audience `ticket-platform-api` ≠ `ticket-api`, đặt trực tiếp vào cookie `oidc_access_token`/`web_oidc_sub` — `forwardWithBearer` nhận 401 từ API, không refresh token nên fail-closed, xóa cookie, không lộ `userId`); thêm `an expired access token with no refresh token fails closed instead of granting a session` (dùng `shortWeb`, chờ qua `exp` thật, xóa cookie refresh trước — `/api/bff/me` 401, không âm thầm coi hợp lệ). Gap còn lại ghi trong `coverage.json`: issuer sai cần realm Keycloak thứ hai mà harness (`runtime.mjs`) chỉ cấp một realm `e2e-<runId>` mỗi run — không có đường tạo token ký hợp lệ với issuer khác để kiểm từ slice web; cần coordinator quyết định thêm realm phụ vào harness hay chấp nhận gap.
- Lệnh kiểm tra khác đã chạy lại trên source mới: `pnpm exec tsc --noEmit ...tests/e2e/web/*.ts` PASS không lỗi type; `pnpm exec prettier --check tests/e2e/web/*.ts tests/e2e/web/coverage.json` PASS; `pnpm exec playwright test -c tests/e2e/playwright.config.ts tests/e2e/web --list` PASS discovery 47 test/5 spec; `pnpm test:e2e:guards` PASS 16/16.
- Không sửa `apps/web`, `apps/portal`, backend, worker, mobile hoặc harness trong dispatch này; chỉ `tests/e2e/web/auth.spec.ts`, `tests/e2e/web/helpers.ts`, `tests/e2e/web/coverage.json`.

## Bổ sung AUTH-05/06 — 29/10/2026

HTTP run `mvsyhf8g-55a61e` (`node tests/e2e/harness/run.mjs http --case=AUTH-06`) PASS 1/1; browser run `mvsyhvyb-0f40bb` (`node tests/e2e/harness/run.mjs e2e --case=AUTH-05,AUTH-06`) PASS 3/3, trên working tree chưa commit dựa trên HEAD `d63b4eb`, dùng Keycloak/PostgreSQL/API thật, không skip-build.

- **AUTH-05** (`auth.spec.ts:114`, `:149`): test đầu xác nhận access token TTL ngắn tự rotate qua BFF. Test thứ hai revoke refresh token thật qua Keycloak `/protocol/openid-connect/revoke`, chờ đúng `exp` thật của access token hết hạn rồi mới gọi `/api/auth/refresh`: actor bị revoke nhận redirect `/auth`, mất cả ba cookie `oidc_access_token`/`oidc_refresh_token`/`web_oidc_sub`, `/api/bff/me` trả 401. Actor khác (context/cookie-jar riêng) vẫn refresh thành công, `/api/bff/me` 200 và body không lộ `userId` của actor bị revoke. Test còn phân biệt rõ: gọi trực tiếp API bằng access token đã hết hạn vẫn 200 trong 5 phút vì JWT verification của API cho phép clock skew theo thiết kế (không phải lỗi) — đường BFF cookie-refresh dùng refresh token nên fail-closed ngay khi bị revoke, hai đường này độc lập.
- **AUTH-06** (`auth.spec.ts:252` + `http/live.test.mjs#[AUTH-06]`): browser xác nhận attendee session không tự có Portal `/api/bff/me/subject` (401). HTTP test revoke thật ba lớp dưới `SET LOCAL ROLE ticket_runtime` + tenant RLS (yêu cầu `rowCount=1` mỗi lần revoke, không revoke rộng): `memberships.revoked_at` → scanner tạo gate-session kế tiếp bị deny; `event_assignments.revoked_at` → manager tạo gate bị deny; owner revoke staff session đang mở qua API → supervisor confirm reservation đang chờ trả `409 SESSION_NOT_ACTIVE`, báo cáo `checkInSuccessCount` không tăng (không có false-success).
- Gap còn lại: AUTH-06 chưa kiểm "UI không báo thành công từ capability cũ" ở tầng UI gate/check-in (Portal). Web browser đã bổ sung redeem sau clear session và wallet sau refresh-revoke + access self-expiry (shortWeb); chạy targeted `--case=AUTH-06` để ghi evidence run id. AUTH-05 chưa có case H riêng cho actor tự để access token hết hạn rồi không refresh. Các entry coverage vẫn `blocked`; các run trên chứng minh những nhánh đã kiểm.

## Bổ sung WEB-09 — 30/10/2026

Run cô lập `mvuwgqol-9172ce` trên clean checkout SHA `6c4254bc0d9063bba9a77b027ea2df8efda9090e`: `node tests/e2e/harness/run.mjs e2e --case=WEB-09` PASS 1/1 browser (`summary.json` `evidenceExactShaEligible` true). Bổ sung assert: detail ACTIVE của X có QR; Y bị chặn trên vé REVOKED/CANCELLED, ticket id giả và `tenantId` lệch ngoài BFF. PG isolation, ví/list/detail/QR/request/operation và nhãn REVOKED/CANCELLED giữ như run `mvsy2fr7-514bd0`; fixture vẫn gán hai trạng thái trực tiếp trong DB, không kiểm transition/cascade. `pnpm test:e2e:guards` PASS 16/16.

## Bổ sung WEB-09 — 29/10/2026

Run cô lập `mvsy2fr7-514bd0`: `pnpm test:e2e:smoke --case=WEB-09` PASS 1/1 browser test, dùng Keycloak/API/PostgreSQL thật. Fixture X có bốn vé ở hai tenant và không có staff membership; Y không có membership hoặc vé. Test đối soát DB qua runtime role + transaction-local RLS, ví/list/detail/QR, request và operation owner isolation, cùng nhãn/cảnh báo REVOKED/CANCELLED. Fixture đặt hai trạng thái này trực tiếp trong DB, không kiểm luồng revoke/cancel hoặc cascade; reviewer chưa tìm thấy luồng backend tạo trạng thái CANCELLED. `pnpm test:e2e:guards` PASS 8/8; Web `typecheck` và `lint`, typecheck test Web, Prettier đều PASS. Coverage WEB-09 đổi thành `implemented`; các nhận định WEB-09 ở phần báo cáo baseline bên dưới là lịch sử.

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
4. WEB-10 fault B+H đã covered tại SHA `85ddecddb8f2` (run `mvux2lwy-e9069f`, 6/6); vẫn không cold-offline/PWA. AUTH-05/06/08 và WEB-04/05/06/12 còn AC phụ hoặc blocker ghi trong `coverage.json`.
5. WEB-13 Portal selectors dựa trên `app/t/[tenantId]/e/[eventId]/guests/page.tsx` và `src/ops/panels/import-invitations-panel.tsx` hiện hành; phải revalidate sau khi harness provision dữ liệu. Import job và Mailpit được poll theo kết quả thật; không suy từ trạng thái SMTP `ACCEPTED` là người nhận đã đọc.
6. AUTH-08 hiện assert consent disable/enable, đúng một browser POST, HTTP ACK `200/201/202` với `requestId` và `REQUESTED`, rồi UI ACK không hứa xóa ngay. Nếu API gate từ chối sau request, test sẽ fail tại HTTP status; không chuyển sang success giả. Thiếu DB one-open-request và revoke/job evidence.
7. WEB-01 theo PRD M03: private/unlisted không vào catalog nhưng direct link phải hiển thị event đã publish. Source `loadPublishedEventDetail` hiện chỉ nhận `PUBLIC`, nên assertion mới có thể FAIL sản phẩm; không sửa product trong slice test.
8. WEB-13 smoke `mvs7goky-950046` AUTO timeout khi AntD `option` hidden; snapshot thấy dropdown option hiển thị ở portal. Test nay chọn `.ant-select-dropdown:visible .ant-select-item-option-content` và cleanup bằng `Promise.allSettled` để lỗi đóng context không che lỗi gốc. Run `mvt16o7f-e1c74b` AUTO fail vì `expect.poll` lồng `waitForResponse` 15s trong khi nút list `loading={busy}` hoặc tab dispatch chưa sẵn sàng — `api.log` không có `guest_invitations.list` cho event AUTO, MANUAL PASS. Sửa poll BFF `page.request` rồi một lần click UI; targeted `mvt1fsct-d7a38d` PASS 2/2.

`coverage.json`: WEB-08 P0 B/H/R `covered` tại SHA `e1c6c22e` (run `mvuyn4d9-296c6f`); các nhóm `blocked` còn lại do AC phụ hoặc cần control/fixture — xem từng `reason` trong file.
