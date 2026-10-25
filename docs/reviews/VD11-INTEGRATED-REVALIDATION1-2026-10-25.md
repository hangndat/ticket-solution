# VD11 — revalidation tích hợp sau fix batch 1/2

**Reviewer:** James (`reviewer-merged`, DoD + Security + UI/UX), session `orca_session_id:8fbf1623-7e8a-4bd9-9513-85cd79bee483`, dispatch `ctx_a0be7db83098`; độc lập với Higo, Enton, Linh và coordinator. **Cost tier:** high; review UI theo incumbent, một context theo Task, không mở redesign hoặc spawn con. **Architecture impact:** Có — O24 đổi audience/session web; O02 iOS giữ nguyên. Không sửa source, contract, commit, push, PR hoặc deploy.

**SHA đã review trước:** `767913e8e5a523d672ccf5801e7dde55c1dbb464` → **exact HEAD revalidation:** `39381a802c29787980e1b1a7848f814540f891d8` (`git rev-parse HEAD`, worktree sạch trước review). Diff đã kiểm: `apps/web` proxy/header/nav controller/tests; `apps/portal` CSS/PageContainer/config table; O24 tại Decision Log, PRD M02 và ADR-20; docs/evidence còn lại. Web tree tại HEAD bằng `6cad86645ae09f7e86fd7a2e0a47ea60c341456d:apps/web` (`acaa1d849a7141b3e309035dba4721cea8f1d2f5`); Portal tree bằng `de127569:apps/portal` (`0c6d1cc604cf3f5fb8b45c1c842704b97605695b`), cherry-pick từ Linh `59adeacb9f6e2e97647ab44bdcee4d0eb6c59e5a`. Không audit lại toàn bộ initial candidate: phần không đổi giữ kết luận [review đầu](./VD11-INTEGRATED-REVIEW-2026-10-25.md), trừ bằng chứng mới W-F04.

## Verdict

| Gate | Kết luận tại HEAD | Căn cứ |
| --- | --- | --- |
| **DoD** | **FAIL** | `VD11-W-F04` mới xác minh còn mở; logout/đổi tài khoản trên thiết bị dùng chung không xóa dữ liệu vé đã vẽ trong tab cũ theo PRD M02. |
| **Security** | **FAIL** | Dữ liệu vé của A còn hiển thị ở tab cũ sau khi phiên hiện hành thành B; đây là lộ dữ liệu qua UI trên thiết bị dùng chung. Chưa có bằng chứng B gọi API đọc được vé A; không kết luận backend/RLS hỏng. |
| **UI/UX** | **FAIL** | Portal P-F03/P-F04 đạt trên config thật; web lại hiển thị ví A khi header/session đã theo B. Đây là sai state/identity có tác động người dùng, không phải nhận xét thẩm mỹ. |

**Lượt sửa tự động:** **1/2** toàn VD11, còn **1 batch**; ngoại lệ chưa dùng. Candidate là code fix đã bàn giao cho năm finding cũ, chưa acceptance complete/pilot ready và chưa đủ gate triển khai.

## Bằng chứng và checks

| Phần | Kết quả |
| --- | --- |
| W-F01 | `apps/web/src/portal/legacy-cutover.ts:5-16` thêm prefix `/api/bff/tenants`; `apps/web/proxy.ts:115-116` trả 410 trước route handler. Production route test nguồn `6cad8664` thử old staff cookie trên GET/POST invites/members/revoke, tất cả 410 và upstream tenant-admin spy không tăng; attendee claim/invite vẫn giữ CSRF 403 thiếu Origin, platform auth 410. |
| W-F02/F03 | `apps/web/src/nav/nav-identity-controller.ts:35-64` clear avatar trước refresh, version guard response cũ; `nav-capabilities-store.ts:96-107` publish guest pending ngay. Deferred tests ở `apps/web/tests/nav-identity-controller.test.ts` và `nav-sec-cache.test.ts` bao phủ A→B cùng authenticated, response đến muộn, revoke và pending. [Coordinator Orca UAT](./VD11-WEB-FIX1-COORDINATOR-UAT-2026-10-25.md) đo `/me` đúng B, avatar B sau focus; header cùng DOM, 73px tại 1440. Own fresh B probe tại `localhost:3340/wallet`, Orca page `40938dbb-7f91-4f39-b45e-0a22deb6a222`: avatar B, ví trống, `scrollWidth=1440`, header 73px, reserved avatar slot 216px tại 1440. Probe DOM ngay cùng JS stack trước React commit (`pendingHadA=true` của coordinator) không được dùng làm bằng chứng frame rò rỉ. |
| P-F03/F04 | Own Orca Owner OIDC page `5129bd50-7142-4fbf-bc25-8e92559e9861`, config tại `127.0.0.1:3334`: viewport 390/1024/1440, document scrollWidth lần lượt 390/1024/1440; hai affix-wrapper đều 44px ở cả ba cỡ, inner input 24px đã đo tại 390. Tại 390, title đủ text «Cấu hình / brand / xuất bản», box 210.07×44px, parent clientWidth=scrollWidth=210, `white-space: normal`, `overflow: visible`. CSS `apps/portal/app/globals.css:259-267` loại `.ant-btn-sm` khỏi min-height; route `/types` có row General nhưng không có `.ant-btn-sm`, nên không claim runtime measurement của small table action. [Ảnh coordinator](./VD11-PORTAL-FIX1-COORDINATOR-UAT-2026-10-25.md) tại 390/1024/1440 đã mở kiểm; 390 khớp title/form và không có drawer che. |
| W-F04 | [Coordinator UAT](./VD11-WEB-FIX1-COORDINATOR-UAT-2026-10-25.md): tab A có 6 vé; tab khác logout A/login B; tab cũ `/api/bff/me` 200 đúng B và avatar B sau focus nhưng DOM còn 6 ticket links/card A. Ảnh `/tmp/vd11-revalidation1-assets/old-tab-wallet-b-auth-1440.png` cho thấy 6 card; **ảnh một mình không chứng minh avatar B**, nên identity dựa probe UAT coordinator. Own fresh B Orca page nêu trên ở cùng profile sau chuyển phiên có `wallet-empty=true`, ticket cards `0`, avatar label B. |
| Test/build kế thừa | Web `6cad8664`: unit, typecheck, build, production routes **3/3**, targeted lint PASS theo [worker handoff](./VD11-WEB-FIX1-2026-10-25.md); toàn web lint còn lỗi marketing cũ ngoài scope. Portal tree hiện hành: coordinator chạy trực tiếp `pnpm --filter @ticket/portal test` **169 PASS** và build exit 0 trên `de127569` theo [UAT Portal](./VD11-PORTAL-FIX1-COORDINATOR-UAT-2026-10-25.md). Không gọi các checks ấy là đã chạy lại trên SHA docs-only `39381a80`; tree equality ở trên cho phép reuse đúng source. `git diff --check 767913e8..HEAD -- apps/web apps/portal` **PASS** tại reviewer. Không yêu cầu CI/PR trong Task này. |
| UI evidence | `bash docs/agents/tools/ui-evidence-check.sh /tmp/vd11-revalidation1-assets` → **OK, 4 ảnh khác nhau**. SHA-256 prefix: old wallet `f6f1dedd9f65`; Portal 390 `5afb7bfec04e`, 1024 `3ec72ad35985`, 1440 `c88b183ba085`. Impeccable detector trên file UI sửa → `[]`; kiểm Web Interface Guidelines tập trung vào state/overflow trong diff. |

## Bảng findings xuyên suốt

| ID | Trạng thái | Căn cứ / điều kiện đóng |
| --- | --- | --- |
| `VD11-W-F01` | **Đã xác minh đóng** | Prefix tenant-admin trả 410 GET/POST trước BFF forward, upstream spy không tăng; nguồn và test như trên. |
| `VD11-W-F02` | **Đã xác minh đóng** | Avatar A bị clear/revalidate; race response cũ có version guard; coordinator A→B Orca và own B fresh xác nhận trạng thái cuối. Pending DOM trước commit không được tính là painted leak. |
| `VD11-W-F03` | **Đã xác minh đóng** | Snapshot nav xác thực được thay guest ngay trong `refresh()`, test deferred/revoke đạt; slot desktop dự phòng và header 73px tại 1440. Điều này chỉ đóng **chrome** SEC-CACHE, không đóng private page content W-F04. |
| `VD11-P-F01`, `VD11-P-F02` | **Giữ đã xác minh đóng** | OIDC Owner thật, persist menu và `/types` row General trong initial review; Portal source liên quan không đổi ngoài P-F03/F04. Không mở lại. |
| `VD11-P-F03` | **Đã xác minh đóng** | Wrapper 44px, inner 24px tại 390/1024/1440 trên Owner config; CSS loại small button. Small action không có trong fixture runtime, giới hạn đã ghi. |
| `VD11-P-F04` | **Đã xác minh đóng** | Title đủ tại 390 và không document overflow ở 390/1024/1440; PageHeader/CSS và table containment khớp probe + ảnh. |
| **`VD11-W-F04`** | **Mở — code/security + lệch AC/UI, High, chặn merge/deploy** | Bằng chứng và điều kiện đóng dưới đây. |

### VD11-W-F04 — ví riêng tư còn hiện sau đổi phiên ở tab khác

**Contract:** PRD M02 `docs/PRD.md:124-128` yêu cầu header không giữ identity/quyền phiên trước và logout thiết bị dùng chung xóa dữ liệu vé/khách cục bộ; O24 `docs/DECISION-LOG.md:13-16` / ADR-20 giữ audience/session web đúng người hiện hành. **Thực tế:** A logout, B login cùng browser profile; tab cũ sau focus xác minh B nhưng vẫn vẽ 6 card/link vé A, trong khi tab mới B có ví trống. Card chứa event name, trạng thái và phần mã vé; link có ticket ID trong href. Tác động là người dùng B hoặc người kế tiếp trên thiết bị chung nhìn thấy dữ liệu A ngay trên màn hình, dù API B chưa được chứng minh trả vé A.

**Nguyên nhân/vùng ảnh hưởng trên HEAD:** `apps/web/app/(consumer)/wallet/page.tsx:40-47,151-190` load vé bằng server component theo request rồi render card trong RSC tree; `src/owner-ticket/load-wallet.ts` có `cache: 'no-store'` cho upstream nhưng chỉ chạy khi có server request mới. `app/(consumer)/layout.tsx:12-17` giữ header và `{children}`; focus/bfcache listener tại `src/site-chrome.tsx:152-165` chỉ gọi `identity.revalidate()` cho nav/avatar, không invalidate/remount/refetch phần private children. Không thấy `router.refresh()` hoặc consumer private-content boundary trong source web liên quan; `force-dynamic` bảo vệ request mới, không xóa DOM đang mount. Phạm vi fix cần xét wallet, private ticket detail/account và history/router cache/bfcache cùng ranh giới logout/đổi identity; chưa khẳng định từng route phụ đã tái hiện.

**Phân loại diễn tiến:** Finding **mới phát hiện ở revalidation**, không phải regression do diff fix1 của wallet: `wallet/page.tsx`, `load-wallet.ts`, `wallet-ticket-card.tsx` và logout route không đổi từ `767913e8`; header fix1 nay cập nhật B đúng nhưng không quản lý dữ liệu trang A. Đây là lỗi cũ bị bỏ sót trong initial review, có bằng chứng runtime mới; giới hạn 1/2 không miễn privacy gate.

**Điều kiện đóng cụ thể cho batch 2/2:** Khi A logout hoặc cookie/session đổi sang B ở tab khác, tab A phải che/xóa ngay private ticket DOM trước khi xác nhận phiên mới; sau xác minh, chỉ render dữ liệu được tải lại cho subject hiện hành. Orca hai synthetic attendees A (có vé) → B (không vé) cùng profile, hai tab: trên tab cũ sau focus/bfcache, sau một frame có `/me` B, **0** card/link/event/code A và ví trống B; trong pending không có frame hiển thị private A. Thử thêm logout thành guest, back/forward và client navigation từ cache; tab B fresh vẫn đúng. Test regression phải chặn stale RSC/router content qua identity boundary và bảo đảm refresh/reload không cho B truy cập ticket A; không dùng logout full page ở tab mới để thay kiểm tab cũ. Nếu cách sửa đụng auth boundary rộng hơn, coordinator xác nhận contract/ADR và giữ API/RLS làm SoT.

## Giới hạn / bàn giao

Reviewer không tái diễn toàn bộ A→B bằng tab riêng; kết luận W-F04 kết hợp coordinator Orca A→B, ảnh 1440 đã kiểm, own fresh B probe và source path tất định. Không dùng hidden React streaming `S:0` hoặc `pendingHadA` trước React commit để khẳng định leak được paint; screenshot cũ đã hiển thị 6 card là bằng chứng painted content sau đổi phiên. Không thử click ticket A bằng B và không khẳng định backend authz bypass; không có test physical device/remote CI trong scope. Hai tab Orca do reviewer mở được đóng sau review; server local giữ nguyên cho coordinator.

**Checkpoint coordinator:** gom `W-F04` vào batch fix **2/2** duy nhất, giữ `W-F01..03`/`P-F01..04` đã xác minh; revalidation sau fix pin exact SHA mới và tập trung private content/identity boundary. Nếu W-F04 còn tái hiện sau batch đó, áp review-convergence: chẩn đoán có giới hạn, không lặp fix tự động hoặc tự waive gate.
