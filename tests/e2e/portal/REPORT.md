# Portal/Platform E2E — bàn giao worker

## PORT-13 — revalidation tích hợp 31/10/2026

Clean run `mvvw54qv-c11d7d` tại SHA `dab48d601d34eed68ae8a8e13aa3b2a0157c2811`: browser **PASS 3/3**, zero retry, commitStable/evidenceExactShaEligible=true. Fixture có 55 PENDING_REVIEW; đã assert hai trang 50+5 UUID đúng thứ tự, không trùng, filter đổi UUID và khôi phục saved view trước/sau reload, actor/tenant isolation. Binaries từ `607d89ab` được tái dùng vì delta chỉ bốn assertion chuyển sang `expect.poll`; không đổi runtime. James revalidation đóng F01 provenance và F03 pagination; full PORT-13 vẫn BLOCKED bởi sort contract. Lượt sửa 1/2. Bản ghi trước dưới đây là lịch sử đã được checkpoint này thay thế về provenance và pagination.

## PORT-13 — locale/filter/saved-view B, sort BLOCKED (Higo, 31/10/2026)

**Runtime PASS (partial, không fullgroup)** tại tested SHA `70e1531b7925c5a71037ba27c54223c2d5dec6f1`, run `mvvtnabj-4ca5f2`, `node tests/e2e/harness/run.mjs e2e --case=PORT-13`. `workingTreeDirty=false`, `commitStable=true`, `evidenceExactShaEligible=true`. 3/3 test browser PASS, exitCode 0; cleanup containers/network đã chạy theo harness. AC → assertion → evidence:

- **Locale VI mặc định/EN additive, giữ sau reload**: `portal-core.spec.ts [PORT-13] Portal locale defaults VI and persists EN through reload` — `html[lang]` vi→en, EN giữ sau `page.reload()`.
- **Filter + saved view theo user+tenant, giữ sau reload**: `portal-core.spec.ts [PORT-13] Portal filter + saved view persist for owner and are not hydrated after switching actor...` — filter UUID (`q`) trên `#pending` áp dụng, lưu view qua `SavedViewsToolbar`, mở lại menu sau `page.reload()` thấy tên view đã lưu (localStorage key `userId:tenantId`, `apps/portal/src/views/storage.ts`).
- **Đổi actor không hydrate view cũ (cùng browser profile)**: cùng test — logout owner → `page.context().newPage()` cho `manager` cùng context (cùng cookies/localStorage) → nút "Quản lý view" disabled, tên view của owner không xuất hiện.
- **Đổi tenant không hydrate view cũ (cùng actor, cùng browser profile)**: `portal-core.spec.ts [PORT-13] Portal saved view does not hydrate across tenants for the same owner...` — fixture gốc chỉ có 1 tenant (`FIXTURES.md` ghi cần 2 tenant ACTIVE); provision tenant thứ hai qua helper runtime-role riêng `tests/e2e/portal/port13-db.ts` (không sửa `tests/e2e/harness/seed.mjs` của Gonic), grant owner Membership Owner ở tenant mới qua `@ticket/backend` (`withTenant`/`grantMembership`, cùng cơ chế seed.mjs dùng). Lưu view ở tenant A (`/t/{A}/members`) → không thấy ở tenant B và ngược lại; lưu view riêng ở tenant B → về tenant A vẫn giữ view A, không có view B.

**BLOCKED (không PASS fullgroup):**
- **Sort**: không có UI nào trong Portal wire sort qua `SavedViewsToolbar` (`sort` luôn null) dù `SORT_ALLOWLIST` tồn tại ở `apps/portal/src/views/allowlist.ts`. Kiểm backend: `apps/api/src/approval.ts` `listPending` → `packages/backend/src/redemption-status.ts` `listStaffPendingRedemptions` hard-code `ORDER BY r.created_at ASC, r.id ASC` với keyset cursor gắn chặt thứ tự đó; quét toàn bộ `ORDER BY` ở `cs.ts/gate.ts/guest-invitations.ts/issue.ts/published-events.ts` — không surface nào có sort param. Đây là contract gap Backend/API, không tự sửa trong ownership Web; đã báo coordinator (Minh/leader) qua `ask`, quyết định: giữ BLOCKED, giao backend/architect contract riêng sau slot WEB-12.
- **Pagination (nextCursor thực tế)**: fixture PORT-13 không có PENDING_REVIEW nào được seed (0 dòng), nên nút "Trang sau" (`view.nextCursor`) chưa từng được kích hoạt/kiểm trong lượt này; cơ chế cursor có sẵn trong code (`pending-panel.tsx`) nhưng chưa có evidence browser với dữ liệu thật.

**Không cover**: a11y (O33 OUT theo scope), automation/share server (P2b, chưa có contract — khớp AC "không yêu cầu shared saved views/automation chưa chốt").

## PORT-09 — clean runtime B1 (Minh, 31/10/2026)

**Runtime PASS** tại tested SHA `82089a959f24cf2ec52b110dcd47e5de325d7195`, run `mvvrilmh-ca2b2e`, `pnpm test:e2e --case=PORT-09`. `workingTreeDirty=false`, `commitStable=true`, `evidenceExactShaEligible=true`; start/end commit trùng nhau. Toàn bộ case qua F01 real worker/PG/Mailpit, F02 five-state BFF/list/detail/timeline và browser UNKNOWN, F03 cooldown/limit negative PG assertions. Witness response200/UNKNOWN, ảnh crop panel và metadata viewport1280x720/vi/cs nằm trong results.json attachments, trích nguyên bản ở `tests/e2e/.artifacts/mvvrilmh-ca2b2e/review-evidence/`. Cleanup containers/network đã hoàn tất.

Run dirty B1 bên dưới chỉ là local diagnostic, không gắn lại cho commit. Lượt clean bổ sung được coordinator quyết định trong quyền user “Fix hết đi”; giữ lịch sử2/2 + exception1/1, B1 là batch mới. [Evidence canonical PR#1084](https://github.com/hangndat/ticket-solution/pull/1084#issuecomment-6537617846); verdict độc lập James và CI/merge cập nhật bằng comment trên exact HEAD, không tạo chuỗi commit đổi SHA báo cáo. Coverage chỉ áp dụng PORT-09, không kết luận toàn bộ Issue1035/85nhóm hoặc pilot ready.

## PORT-09 — B1 fix (Higo, 31/10/2026)

**Local PASS; chưa đủ evidence exact SHA.** Nguyên nhân: `isProviderStatus`/`CsProviderStatus` trong `apps/portal/src/ops/contract-shape.ts` + `apps/portal/src/ops/cs.ts` chỉ nhận 4 giá trị (thiếu `UNKNOWN` dù `packages/contracts` đã có từ BE PR#1085), nên `parseNotification` reject vé UNKNOWN → list/detail trả `kind:'unknown'`, bảng CS browser không có cột provider status nên không render chữ `UNKNOWN`, và dòng timeline gộp kind/time/summary vào một text node nên không có phần tử khớp đúng `notification UNKNOWN`.

Sửa: mở rộng guard CS-local (không đụng `isProviderStatusFull` dùng cho notifications.ts — không tác động ngoài CS) thêm `UNKNOWN`; thêm cột provider status vào bảng `CsPanel` dùng `csNotificationStatusText`/`csProviderStatusLabel` có sẵn (nhãn VI chứa chuỗi `UNKNOWN (không rõ...)`, không claim PENDING); tách node `summary` của timeline ra `Typography.Text` riêng để giữ assertion `notification UNKNOWN` đúng, không bỏ assertion. Không đổi AC/fixture, không đổi contract PENDING resend.

Runtime (đúng 1 lần theo scripts có sẵn): `node tests/e2e/harness/run.mjs e2e --case=PORT-09` → run `mvvrcxtx-538df2`, **PASS** (`browser` exitCode 0). Containers/network đã cleanup (`tests/e2e/.artifacts/mvvrcxtx-538df2/cleanup.log`). Run thực thi trên working tree đang sửa (chưa commit lúc chạy) nên `sourceProvenance.evidenceExactShaEligible=false`, `workingTreeDirty=true`; diff được commit sau đó ở `e18b7628`, nhưng không được gắn lại PASS của dirty run cho commit này. Coordinator không chấp nhận claim exact-SHA đó; theo quyền user “Fix hết đi”, bổ sung witness response/ảnh và thực hiện một lần đo clean trên commit mới. Kết quả mới và revalidation sẽ ghi bằng comment PR, không sửa provenance cũ.

Kiểm trước runtime: `pnpm --filter portal typecheck` PASS; `pnpm --filter portal test apps/portal/tests/ops-cs-export.test.ts` (chạy cả suite portal) 305/305 PASS, gồm test mới "accepts all 5 providerStatus values incl. UNKNOWN; rejects malformed" (UNKNOWN + 4 state khác qua `interpretCsList`, và `DELIVERED` giả mạo bị reject `kind:'unknown'`).

F01/F02/F03: F01 (real primary worker/PG/Mailpit ACCEPTED) và F02 (five-state list/detail/timeline + browser UNKNOWN row) nay PASS trong run này (toàn bộ `portal-ops.spec.ts` case PORT-09 xanh, không giới hạn riêng từng F). F03 (negative PG audit/notification/outbox/cooldown+limit) nằm trong cùng spec file/case và cũng PASS theo kết quả run tổng; không có log tách theo F-id trong harness này.

Giới hạn: chỉ sửa `apps/portal/**` (contract-shape.ts, cs.ts, panels/cs-panel.tsx) + test unit mới, không sửa `apps/web`, API/worker/backend/contracts/lockfile, không sửa `tests/e2e/portal/portal-ops.spec.ts` (locator timeline khớp sau khi sửa DOM, không cần đổi spec). Không ảnh/screenshot lưu kèm. Bàn giao để James review độc lập; không tự coi merge-ready.

## PORT-09 — checkpoint hiện tại 30/10/2026

**BLOCKED**, PR #1084 Draft. Ngoại lệ 1/1 sau fix 2/2 đã dùng và dừng: thay fixture UNKNOWN bằng cập nhật notification hiện có, thêm assertion từng vé có expected/actual trước ma trận tổng. Runtime duy nhất `pnpm test:e2e --case=PORT-09`, run `mvv3h42r-633cc2`, **FAIL** trên exact SHA `8728423981ba5e0b73b021eda1859e1bc314806a` tại `portal-ops.spec.ts:735`: không tìm thấy hàng vé UNKNOWN trong browser `#cs` (timeout 15 giây). F01 real worker ACCEPTED + PG attempt/provider_ref + Mailpit correlation và ma trận năm trạng thái/BFF detail UNKNOWN đã qua; F02 browser UNKNOWN chưa đạt, các assertion F03 phía sau chưa chạy. Typecheck portal spec, discovery 1/1, Prettier và 19/19 guards PASS. Không sửa/retry runtime sau FAIL; không reset bộ đếm, chờ coordinator quyết định.

Evidence: `tests/e2e/.artifacts/mvv3h42r-633cc2/summary.json`, `browser-tests.log`. `sourceProvenance`: workingTreeDirty=false, evidenceEligible=true, evidenceExactShaEligible=true, commitStable=true; fingerprint đầu/cuối `4b0e3b2d7b671ab42cd76e10bbe6aee3b4a3544d7915d9980b080a2fc1b37c84`. Các PASS lịch sử bên dưới không thay thế kết quả này.

## Kiểm tra đã chạy (worker task_b9427e2110b4 — James DoD F01/F02 fix 1/2 / PR #1072)

| Lệnh | Kết quả |
| --- | --- |
| `node tests/e2e/harness/run.mjs e2e --case=PORT-02` | **PASS** run `mvuvg7n2-768c19`, browser 1/1; artifact `tests/e2e/.artifacts/mvuvg7n2-768c19/summary.json`. |
| SHA | `4ae03e41e8ce7c253c0f50c2537764bfadc06a7d` (`evidenceExactShaEligible=true`, run `mvuvhcrh-ee2d55`) |

**Thay đổi:** Portal config rollback dùng `useIntentMutation` (`config.rollback`) gửi UUID `idempotencyKey`; nút rollback hiện trên mọi phiên bản khác live published pointer. E2E [PORT-02] click UI rollback, PG snapshot sau mỗi stale 409 (save + rollback), public hero + ticket consent. **Gap:** Web ISR publish delta; PORT-01 public 404 wizard path.

## Kiểm tra đã chạy (worker task_8898495f4d3f — PORT-02 B/H / Issue #1035)

| Lệnh | Kết quả |
| --- | --- |
| `node tests/e2e/harness/run.mjs e2e --case=PORT-02` | **PASS** run `mvuv3fpp-04187d`, browser 1/1; artifact `tests/e2e/.artifacts/mvuv3fpp-04187d/summary.json`; `evidenceExactShaEligible=true`. |
| SHA | `f8152257039a2e6a5f9866b4a774f828c67e4ded` |

**Thay đổi:** mở rộng `portal-event-lifecycle.spec.ts` [PORT-02] — public API `/v1/public/tenants/{tenantSlug}/events/{eventSlug}`, draft/preview không đổi projection, publish/rollback BFF + stale 409, hai browser context stale save, PG `tickets` consent/entitlement bất biến; seed `PORT-02` + `lifecycle-db.ts`; Portal BFF `config/rollback` forward `idempotencyKey`. Run này chỉ chứng minh BFF/API/PG; James đã tìm F01/F02 và worker sửa ở run `mvuvhcrh-ee2d55` phía trên. Full PORT-02 vẫn `blocked` vì Web ISR chưa được kiểm.

## Kiểm tra đã chạy (worker task_ff809609587e — PORT-01 James F01/F02 fix 1/2 / Issue #1035)

| Lệnh | Kết quả |
| --- | --- |
| `pnpm exec playwright test tests/e2e/portal/portal-core.spec.ts -g PORT-01 --list` | Discovery sau chỉnh quota+public projection. |
| `node tests/e2e/harness/run.mjs e2e --case=PORT-01 --skip-build` | Diagnostic `mvuu9ujm-5d0b11` PASS 1/1 trên working tree dirty; `evidenceExactShaEligible=false`, không dùng làm acceptance evidence. |
| `pnpm test:e2e --case=PORT-01` | **PASS** run sạch `mvuubgho-341f75`, browser 1/1 tại exact SHA `3ad80f862d8ffc349578d682b4ec9e446acb1d26`; `evidenceExactShaEligible=true`. |

**Thay đổi spec:** BFF GET `/quota` bắt buộc `422`/`QUOTA_REQUIRED` và UI quota lỗi (không dùng `report.allocated>=0`); sau publish kiểm có version đã publish trong `/config-versions` và staff `contentStatus=PUBLISHED`. API public `/v1/public/tenants/{tenantSlug}/events/{slug}` trả 404; Web `/t/{tenantSlug}/events/{slug}` không hiển thị `event-published`. **Coverage:** `PORT-01` → `blocked` — thiếu UI cấu hình quota/event-wide capacity trên wizard path và public projection sau staff publish (đọc PORT-02/04).

## Kiểm tra đã chạy (worker task_2c21d0516da9 — PORT-01 B / Issue #1035)

| Lệnh | Kết quả |
| --- | --- |
| `node tests/e2e/harness/run.mjs e2e --case=PORT-01 --skip-build` | **PASS** run `mvutztg6-81c23b`, browser 1/1; artifact `tests/e2e/.artifacts/mvutztg6-81c23b/summary.json`. |
| SHA | `affd7b5eaf73e86be05a124d683d2bb09fac7b81` (clean tree, evidenceExactShaEligible). |

PORT-01 B: wizard → loại vé → nguồn AUTO → hạn mức (nav + report quota) → config Lưu draft + Xuất bản → `contentStatus` PUBLISHED, reload, danh sách tenant một event. **Gap ghi nhận:** BFF GET `/quota` 422 trên event mới (UI quota read-only); Web consumer direct link 404 dù staff đã PUBLISHED (không sửa product trong slice test).

- Phạm vi: `tests/e2e/portal/portal-core.spec.ts`, `coverage.json`, `REPORT.md`. Không đụng WEB-11, product, harness seed.

## Kiểm tra đã chạy (worker task_8721cfd967d7 — PORT-08 B/H gap / Issue #1035)

| Lệnh | Kết quả |
| --- | --- |
| `node tests/e2e/harness/run.mjs e2e --case=PORT-08` | **PASS** run `mvut378v-220ec0`, browser 1/1 (2 spec PORT-08); artifact `tests/e2e/.artifacts/mvut378v-220ec0/summary.json`. |
| SHA | `9bec814ed992731399ed937d724445ea133cf054` (clean tree, evidenceExactShaEligible). |

PORT-08: seed harness thêm `holdCodeForReview` + notification email `DEAD` thật → `pendingApprovalCount`/`emailNeedsCsCount`>0; spec assert deep-link CTA `#pending`/`#cs`; fault profile upstream GET `/report` (`error500`) → UI `ops.report.unknown`, không render `.portal-gate-report-compact`. **BLOCKED giữ:** confirm APPLIED/undo/reject O12 — evidence Gate `confirmCheckin`/`undoCheckin` + `DB-15`/`reporting.test.cjs`, không Portal.

- Phạm vi: `tests/e2e/portal/**`, `tests/e2e/harness/seed.mjs` (PORT-08 only), `tests/e2e/harness/run.mjs` (fault path PORT-08), `SEED-REPORT.md`. Không sửa WEB-13 seed, product, CI.

## Kiểm tra đã chạy (worker task_45928c41c91c — PORT-08 B/H / Issue #1035)

| Lệnh | Kết quả |
| --- | --- |
| `node tests/e2e/harness/run.mjs e2e --case=PORT-08` | **PASS** run `mvuss75q-554aba` (baseline), **PASS** `mvustvib-8df4b9` sau bổ sung assertion; browser 1/1; artifact `tests/e2e/.artifacts/mvustvib-8df4b9/summary.json`. |
| SHA | `7db762b15f50aeb9cd8d0cf1d0e870dd2680393e` (clean tree, run `mvustvib-8df4b9`, evidenceExactShaEligible). |

PORT-08 (phần Portal dashboard O12 read): BFF GET `/report` khớp snapshot seed thật (ticket ACTIVE=1, quota FINITE allocated/remaining, counters 0); UI gate `event-report-as-of`, KPI, refresh GET, không Resend trên thẻ; không nút quét/confirm/undo; CTA pending/email CS ẩn khi count=0; quota remaining hiển thị số thật khi FINITE. **Gap giữ BLOCKED:** confirm APPLIED/undo/reject theo dictionary O12 → Gate scan + `DB-15`, không Portal; nhánh deep-link khi pending/emailNeedsCs>0 cần seed harness (tránh đụng WEB-13); lỗi upstream không render 0 giả cần fault profile runtime.

- Baseline đối chiếu: `022cb80fd159dad2a7ebd0eeeea07fd64391f90a` trên `hangndat/local-e2e-regression`.
- Phạm vi sửa: chỉ `tests/e2e/portal/**`. Không sửa product, harness, root package/lockfile/CI hoặc `PLAN.md`.
- Architecture impact: Không. Spec dùng Playwright browser thật, BFF same-origin và Keycloak login/TOTP; không mock token/cookie/auth.

## Kiểm tra đã chạy (worker task_f43f26c1cfc5 — PORT-07 sortOrder H / Issue #1035)

| Lệnh | Kết quả |
| --- | --- |
| `node tests/e2e/harness/run.mjs e2e --case=PORT-07` | **PASS** run `mvusk9f6-1ab717`, browser 1/1; artifact `tests/e2e/.artifacts/mvusk9f6-1ab717/summary.json`. |
| SHA | `1597891a9ed9724e53f726dfb4e4db17ce93c660` (clean tree, evidenceExactShaEligible). |

PORT-07: giữ owner/scanner/reader; BFF owner path thêm sortOrder `0`/`9999` chấp nhận (min gate qua POST), `-1`/`10000` → 422 `SCOPE_REQUIRED` (upstream envelope qua BFF passthrough, message `between 0 and 9999`); non-int vẫn `SORT_INVALID` tại BFF. Gap sortOrder upstream: đóng trên nhánh H.

## Kiểm tra đã chạy (worker task_563b98d49ff0 — PORT-07 fix iter 1/2 / Issue #1035)

| Lệnh | Kết quả |
| --- | --- |
| `node tests/e2e/harness/run.mjs e2e --case=PORT-07` | **PASS** run `mvur8f0q-148a80`, browser 1/1; artifact `tests/e2e/.artifacts/mvur8f0q-148a80/summary.json`. |
| SHA | `e577cdb49a0f8cb37131bc39b3cf0775db943995` (clean tree, evidenceExactShaEligible). |

PORT-07: giữ toàn bộ assertion owner/scanner trước; seed fixture gán `cs` trên event `report.read`+`gate.confirm` (không `event.update`); browser reader thấy bảng cổng, không nút Thêm cổng, BFF GET list OK và POST 403. Gap còn lại: max sortOrder 9999 chỉ kiểm ở Portal InputNumber/BFF owner path — chưa assert upstream API reject >9999 (điều phối coordinator).

## Kiểm tra đã chạy (worker task_ac6fd382f590 — PORT-07 / Issue #1035)

| Lệnh | Kết quả |
| --- | --- |
| `node tests/e2e/harness/run.mjs e2e --case=PORT-07` | **PASS** run `mvuqvewt-f6a776`, browser 1/1; artifact `tests/e2e/.artifacts/mvuqvewt-f6a776/summary.json`. |
| SHA | `c45632602b4dfe820a6d42d2f7fe86931b755b22` (clean tree, run `mvuqvewt-f6a776`, evidenceEligible). |

PORT-07: zero-gate hướng dẫn VI, create/list đúng event, tên 1–80 và order 0/9999 (UI+ BFF), `GATE_NAME_CONFLICT` UI tiếng Việt + HTTP 409, scanner POST 403 (thiếu `event.update`), không scan/confirm/undo/rename/delete/link Web `/gate`. Gap: chưa có actor Portal read-only trên panel (CS thiếu `report.read`; manager có `event.update`).

## Kiểm tra đã chạy (worker task_bc250bdc551b — PORT-04/08/09)

| Lệnh                                                                                                                                                                              | Kết quả                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `pnpm exec playwright test tests/e2e/portal --list`                                                                                                                               | PASS discovery: 20 test trong 5 file (thêm PORT-04 mutation guard).                                                         |
| `pnpm exec tsc --noEmit … tests/e2e/portal/*.ts`                                                                                                                                    | PASS sau bổ sung PORT-04/08/09.                                                                                           |
| Runtime browser HTTPS                                                                                                                                                             | **Không chạy** — chờ coordinator cấp slot; chỉ source review + typecheck/list.                                            |

### PORT-04/08/09 — đối chiếu AC (28/10 PLAN)

| ID      | Đã viết thêm trong spec                                                                                         | Blocker còn lại                                                                                                                                    |
| ------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| PORT-04 | Quota/report FINITE đồng bộ; UI quota + `event-report-as-of`; BFF quota từ chối POST/PATCH/PUT, snapshot không đổi | Không có UI/BFF sửa capacity; nhánh giảm dưới allocated+hold, validate type/source, actor thiếu quyền cần product + seed `allocatedPlusHold`/editor deny |
| PORT-08 | KPI BFF đủ quotaRemaining/state; gate asOf, check-in count, refresh GET, deep link khi count>0, fault upstream không render 0 giả, không nút resend trên dashboard | `confirm APPLIED/undo/reject` thuộc Gate app (O12) + DB-15; Portal chỉ read KPI — BLOCKED với source evidence, không product feature |
| PORT-09 | Timeline masking; tra cứu UUID lạ rỗng; resend + cooldown 429 giữ ticket/state                               | Seed thiếu ma trận provider PENDING/FAILED/DEAD/UNKNOWN; chưa assert deny cross-event; giới hạn resend ngoài cooldown cần fixture riêng            |

Không sửa harness cho PORT-09 notification states (PORT-08 counters/fault đã seed trong worktree này).

## Kiểm tra đã chạy

| Lệnh                                                                                                                                                                              | Kết quả                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `pnpm exec playwright test tests/e2e/portal --list`                                                                                                                               | PASS discovery: 19 test trong 5 file (sau lượt bổ sung, chạy lại ở cuối).                                                 |
| `pnpm exec tsc --noEmit --module esnext --moduleResolution bundler --target es2022 --typeRoots apps/portal/node_modules/@types --types node --skipLibCheck tests/e2e/portal/*.ts` | PASS, không lỗi type/syntax trong folder.                                                                                 |
| `pnpm exec playwright test tests/e2e/portal/portal-core.spec.ts -g 'PORT-07' --reporter=line`                                                                                     | BLOCKED trước assertion: Playwright Chromium headless shell `chromium_headless_shell-1194` chưa có trong cache.           |
| Runtime do coordinator chạy, `mvs7d4db-259457`                                                                                                                                    | PORT-01 PASS qua browser/BFF thật.                                                                                        |
| Runtime do coordinator chạy, `mvs7lq8o-b4964d`                                                                                                                                    | PLAT-01 và PLAT-05 PASS; Operator MFA/TOTP, Owner bị từ chối Platform, và Portal lỗi cấu hình chạy ở process HTTPS riêng. |
| Runtime do coordinator chạy, `mvs7goky-950046`                                                                                                                                    | PORT-05 FAIL tại AntD option ẩn; selector đã đổi sang dropdown hiện, cần retry.                                           |

## Kiểm tra đã chạy (worker task_6e7e5a20feff — James DoD F01–F03 / PR #1074)

| Lệnh | Kết quả |
| --- | --- |
| `node tests/e2e/harness/run.mjs e2e --case=PORT-05` | **PASS** run `mvux2cef-af8a55`, browser **6/6**; artifact `tests/e2e/.artifacts/mvux2cef-af8a55/summary.json`. |
| `pnpm test:e2e:guards` | PASS 16/16. |
| SHA (pre-commit tree) | `dbd3d762d53f1663624cd95c4d5f3c774a4f075e` — `evidenceExactShaEligible` sau commit sạch trên cùng SHA. |

PORT-05 DoD fix: UI mapping/preview/commit/list + error report download; EMPTY malformed row (two-column CSV); PostgreSQL `businessRowsUnchanged` + code status; `otherAttendee` actor deny với `fileId` thật và PG không đổi khi từ chối scope.

## Kiểm tra đã chạy (worker task_0d776f472c26 — PORT-05 B/H / Issue #1035)

| Lệnh | Kết quả |
| --- | --- |
| `node tests/e2e/harness/run.mjs e2e --case=PORT-05` | **PASS** run `mvuwdtj0-b1f0b9`, browser 5/5; artifact `tests/e2e/.artifacts/mvuwdtj0-b1f0b9/summary.json`; `evidenceExactShaEligible=true`. |
| SHA | `405f305c3b731a02132c9fd5e949dd25234871a6` |

PORT-05: seed harness thêm CSV duplicate/existing/row-limit, consumed code PG, foreign tenant/event; spec mở rộng BFF upload/create (idempotencyKey body+header), preview duplicate + `/errors`, commit skip + replay, row limit preview 422, cross-scope deny. UI smoke giữ AntD `.ant-select-dropdown:visible`. **Gap nhỏ:** EMPTY CSV row chưa assert browser (parser bỏ dòng trống trong fixture); DUPLICATE_IN_FILE + skip used codes đáp ứng sai dòng/trùng/mã đã dùng.

- Phạm vi: `tests/e2e/portal/**`, `tests/e2e/harness/seed.mjs` (PORT-05). Không sửa product/CI.

## Đã viết và giới hạn

- 19 spec thao tác/read thực, mỗi ID một spec, cho wizard/config/event/clone/quota, import, approve, cổng vào, KPI, notification, portfolio, member invite, onboarding, locale, audit/codes, Operator MFA, tenant activation, support grant và platform health/audit.
- Đối chiếu selector với source Portal/Platform: import chọn option trong dropdown AntD hiện; pending mở `#pending` để chuyển đúng Vận hành; KPI kiểm `href` ở Link bao Button; portfolio kiểm link event được gán thay vì tìm UUID trong text bảng. PORT-07 kiểm thêm BFF từ chối tên cổng rỗng bằng `422 NAME_INVALID`; PLAT-03 kiểm mã lỗi scope/TTL và grant response thực (`grantId`, `expiresAt`, không có `scopes`).
- Spec `PORT-11` tạo staff invite qua Portal và đợi email Mailpit từ worker thật. Source hiện có `POST /v1/platform/me/membership-invites/accept` ở API và **Web legacy** `apps/web/app/(consumer)/invite/invite-accept.tsx` + `/api/bff/me/membership-invites/accept`, nhưng không thấy Portal accept BFF/UI. Đây là divergence O16 so với câu chữ "portal login/accept"; phần login/accept, TTL/reuse/wrong actor còn BLOCKED trong scope này, không đánh đồng với guest claim `WEB-13`.
- `PORT-04` mới kiểm quota read: UI quota và BFF quota hiện chỉ GET, chưa thấy thao tác sửa quota. `PORT-02` mới kiểm draft/public projection và stale version qua BFF; `PLAT-05` mới kiểm OIDC setup fail-closed. Các nhánh còn thiếu ghi riêng trong `coverage.json`.
- Fixture keys và event assignment/permission tối thiểu trong `FIXTURES.md`; Owner cần assignment cho report/audit, Operator cần TOTP ACR2. Không cấp rộng quyền chỉ để test qua.

## Việc cần để chạy tiếp

1. Coordinator retry PORT-05 sau selector fix và chạy full suite trên runtime HTTPS cô lập; ghi PASS/FAIL theo actual response/DB/mail. *(PORT-05 selector + B/H slice PASS tại task_0d776f472c26 — xem mục trên.)*
2. Hoàn thiện nhánh còn thiếu trong `coverage.json`, đặc biệt B/H/R của PORT-11, 15 phút step-up của PLAT-01 và H/D audit của PLAT-03.
