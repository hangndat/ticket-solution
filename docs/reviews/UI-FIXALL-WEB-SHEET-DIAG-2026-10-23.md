⚠️ DEGRADED: single-context (worker không được spawn sub-agent theo giao việc; critique và kiểm browser thực hiện tuần tự).

# UI-FIXALL — Chẩn đoán SiteNav / shared Sheet (#859)

| Mục | Giá trị |
| --- | --- |
| Reviewer | Codex · `task_172ae9addda4` / `ctx_089ca314662a`, độc lập Higo |
| Scope | Chỉ đọc `apps/web/src/site-chrome.tsx`, `packages/ui/src/components/ui/sheet.tsx`; runtime consumer `/` |
| SHA | `b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37` (working tree dirty) |
| Source SHA256 | `site-chrome.tsx`: `44c4b9569c21d11134c6e453769073172cc400360f0ee4c952fe5d990a2b3414`; `sheet.tsx`: `091b4c6c65c4129cdf8561199b461712c577df15a3abe7d36cab1c6b6ac9e955` |
| Môi trường | Orca embedded browser, `http://localhost:3000/`, actual `innerWidth=390`, `innerHeight=844`, DPR 1, VI guest, light; page IDs `4974b9af-7b50-4a8f-b842-6c97d099ce5c` (initial), `91081e2c-8d12-4c35-91fd-44c60da6cf29` (reduced motion), `67fdf22c-3dc6-4ead-9aa2-5885603ee849` (normal fresh) |
| Mẫu / quyết định | D11 §6.1 guest navigation, O02 permission navigation; lỗi được xét ở tương tác Sheet, không kết luận lại quyền/capability |

## Kết quả chẩn đoán

| ID | Loại / mức độ | Bằng chứng và phân loại nhân quả | Điều kiện đóng / owner |
| --- | --- | --- | --- |
| **F-WEB-04** | a11y / blocker acceptance; **mở, chưa chấp nhận đóng** | Tab đầu, normal motion: sau Escape `data-state=closed` nhưng dialog vẫn mounted và `document.activeElement` chính là `div[data-testid=nav-mobile-menu]` (ancestry `DIV → BODY → HTML`). `getAnimations()` trả `currentTime=0`, `startTime=null`, `pending=true`, `playState=running` trong khi `document.timeline.currentTime` tăng từ khoảng 22,223 đến 52,055 ms, `visibility=visible`. Focus trong closed dialog là lỗi hành vi ở lần chạy này. Tuy nhiên tab normal mới đóng đúng: dialog unmounted, focus về `nav-menu-toggle`; tab reduced motion cũng đóng đúng. Vì callback `onCloseAutoFocus` ở `site-chrome.tsx:275–282` chỉ có thể chạy khi Radix hoàn tất close/unmount, bằng chứng **chưa chứng minh source callback sai**. Nghiêng về animation/compositor scheduling hoặc tương tác engine/probe; không waive edge, không ép `animation.finish()` làm acceptance. | Higo/coordinator tái hiện trên clean browser/tab và một engine người dùng mục tiêu với normal motion, ghi `pending/startTime/currentTime`, rAF/paint, dialog mount và `activeElement.closest('[role=dialog]')` trước/sau Escape; xác định lý do animation không bắt đầu/kết thúc trong tab lỗi. Chỉ đóng khi mọi path dismiss được giao đều unmount và focus trở về trigger/đích hợp lệ sau animation tự nhiên, hoặc có quyết định môi trường với evidence độc lập và gate thay thế. Không giao sửa callback mù. |
| **F-WEB-05** | chrome / blocker web mobile; **source defect trong shared UI** | `sheet.tsx:72` khai báo `w-[min(100vw-3rem,20rem)]`. Orca browser trả `CSS.supports('width','min(100vw-3rem,20rem)')=false`, bản `min(calc(100vw - 3rem), 20rem)` = true. Ở 390×844, Sheet mở có computed width `8px`, rect width `41px`, nằm thành dải hẹp bên phải; [ảnh runtime](assets/UI-FIXALL-WEB-SHEET-DIAG-2026-10-23/normal-open.png) xác nhận tác động nhìn thấy. Cùng kết quả width ở normal và reduced motion, nên đây không phụ thuộc animation/focus probe. | **Coordinator contract correction** ở `packages/ui/src/components/ui/sheet.tsx:72` (shared owner), sửa width sang cú pháp engine chấp nhận, rồi kiểm computed width/rect và ảnh tại 390×844, normal + reduced motion; kiểm cả consumer `SiteNav` và marketing `marketing-mobile-nav-menu.tsx`. Higo web không tự sửa package. |

### Ranh giới kết luận

- `F-WEB-04` trong review trước được ghi Closed dựa trên một Escape isolated PASS, còn `10×Tab + Shift+Tab + Esc` chỉ ghi edge. Bằng chứng mới của coordinator (`.orca-metrics/fix-all/coordinator-web-focus.json`, `coordinator-web-animation-diagnostic.json`) và tab đầu ở review này cho thấy closed dialog vẫn chứa focus. Vì một tab normal mới PASS, đây là lỗi **tái hiện không ổn định**, chưa xác định source hay Orca engine. Không thể giữ verdict PASS acceptance cho F-WEB-04.
- Reduced motion được đặt bằng `orca exec --command 'set media light reduced-motion'`, xác nhận bằng `matchMedia`. Sau clean page, mở Sheet cho `getAnimations()=[]` dù computed `animationName=enter`; Escape unmount và trả focus đúng. Không inject CSS/style. Kết quả này chứng minh đường reduced motion trong lần chạy này, không chứng minh normal motion luôn đúng.
- `animation.finish()` từng được coordinator dùng **chỉ để chẩn đoán**; không dùng trong các acceptance probe của report. `offsetParent=null` không được dùng để suy dialog hidden. Link `nav-events` có test ID trùng desktop/Sheet nên đánh giá focus bằng `closest('[role=dialog]')`/`contains()`, không theo test ID đơn lẻ.
- Shared blast radius trực tiếp: `packages/ui/src/components/ui/sheet.tsx` → `packages/ui/src/client.ts` → `apps/web/src/site-chrome.tsx` và `apps/web/src/marketing/marketing-mobile-nav-menu.tsx`. Không thấy `SheetContent` ở slice app khác qua `rg` trong `apps`/`packages`; không suy ra mọi route đã được runtime kiểm.

## Checks / evidence

1. `orca tab create --url http://localhost:3000/ --worktree path:/Users/admin/orca/workspaces/main/UI-audit`; `orca exec --page … --command 'set viewport 390 844'`; `orca snapshot`; `orca click @e10`; `orca eval`; `orca keypress Escape`; `orca eval`. Dữ liệu fresh normal: [open JSON](assets/UI-FIXALL-WEB-SHEET-DIAG-2026-10-23/normal-open.json), [closed JSON](assets/UI-FIXALL-WEB-SHEET-DIAG-2026-10-23/normal-closed.json).
2. Tương tự trên page reduced motion sau `set media light reduced-motion`: [open JSON](assets/UI-FIXALL-WEB-SHEET-DIAG-2026-10-23/reduced-open.json), [closed JSON](assets/UI-FIXALL-WEB-SHEET-DIAG-2026-10-23/reduced-closed.json).
3. Initial page animation/focus probe: Orca command IDs `65f9ae50-5fc2-49b7-9702-f7064b7c79a4`, `9826493a-a5ab-4b87-bb56-3a8625446cfe`, `3d1250eb-69bd-466c-bf97-54c0c415ae1e`, `d07b8b45-a662-4d90-a7bc-534feeec7dfb`. Sau reload page này không trả probe DOM, nên dừng thử trên tab đó và tạo page mới; không gán hang này cho source sản phẩm.
4. `impeccable detect --json apps/web/src/site-chrome.tsx packages/ui/src/components/ui/sheet.tsx` → `[]`. Review dùng `vercel-react-best-practices`, `impeccable critique` (single-context theo task), Orca browser; detector không thay runtime evidence.
5. Ảnh `normal-open.png` đã mở xem lại: URL consumer `/`, Sheet mở, viewport 390×844, dải Sheet bên phải 41px; SHA256 `c4892d76484fc29a7d8453b721b167e123fa3f18a0ab0631fa55e56fdfe3a2c8`.
6. `bash docs/agents/tools/ui-evidence-check.sh docs/reviews/assets/UI-FIXALL-WEB-SHEET-DIAG-2026-10-23` → `OK: 5 file, không trùng nội dung.`

## Verdict

**UI/UX: FAIL** cho Sheet mobile width (`F-WEB-05`). **DoD/acceptance: FAIL** cho đóng F-WEB-04 ở web slice trên trạng thái source hiện tại, vì edge closed dialog giữ focus đã tái hiện nhưng nguyên nhân còn cần chẩn đoán; PASS ở tab khác không triệt tiêu lần lỗi. Chưa đánh giá production/pilot ready. Không sửa source, commit, deploy hoặc publish.

Questions skipped: worker report chỉ bàn giao findings và điều kiện đóng cho coordinator/Higo; không mở quyết định thiết kế mới.
