# Review PR #1174 — Portal guest list + notification boundary integration — 03/11/2026

- Reviewer: James (`reviewer-merged`, DoD + Security + UI/UX); độc lập với Higo implementation/integration Dispatch `ctx_ac1be2a7348d`.
- Product SHA: `17c865e7094a34b7bc45fa35e9c402867347dd36`; base `9993d354ef1e2dda8835175ceee24e5b28389466`; phạm vi đúng bảy file Portal:
  `apps/portal/src/guests/{guest-list-page.ts,guest-workspace.tsx,use-guest-list-page.ts}`,
  `apps/portal/src/ops/{notifications.ts,notification-commands.ts}`,
  `apps/portal/tests/{guest-workspace-query.test.ts,ops-notification-bff.test.ts}`.
- CRG: graph rebuilt on this exact worktree/HEAD (full rebuild, 1622 files, 10117 nodes, head_matches_build=true); `file_summary` trên `notifications.ts`/`guest-workspace.tsx`, `importers_of(notifications.ts)` = 6, `importers_of(guest-list-page.ts)` = 3 — khớp số importer trong hai review baseline, không có dependent mới ngoài phạm vi.
- Baseline đã đọc làm nền tham khảo (không kế thừa PASS): `docs/reviews/GOD-CLASS-PORTAL-GUEST-2026-11-03.md` (SHA `c501e5f9`, DoD/Security/UI PASS) và `GOD-CLASS-PORTAL-NOTIFICATIONS-2026-11-03.md` (SHA `61320b95`, DoD/Security/UI PASS). Hai file này không có trong working tree ở SHA hiện tại (chỉ tồn tại trên nhánh `hangndat/god-class-refactor`); đã lấy nội dung qua `git show hangndat/god-class-refactor:<path>` để tham chiếu, không coi là PASS kế thừa cho SHA #1174.

## Kết luận

- **DoD: PASS.** Ba commit trong range (`76abecef` guest state extraction, `48be6b84` notification command boundary, `17c865e7` Prettier) tái tạo đúng hai refactor đã review độc lập trước đó, gộp chung trên cùng base. Toàn bộ logic được **di chuyển nguyên văn** (verified bằng diff dòng-theo-dòng), không có thay đổi hành vi.
- **Security: PASS.** Không tìm thấy regression nào trên các điểm nhạy cảm đã kiểm: escaping path tenant/event, idempotency fingerprint, ACCEPTED semantics, permissions, URL/query, locale, stale response, privacy masking.
- **UI/UX: PASS.** JSX trong `guest-workspace.tsx` chỉ đổi theo state/hook extraction + Prettier reflow; không đổi nhãn, trạng thái loading/error/empty/pagination, hay cấu trúc panel. Runtime viewport probe **không phải gate bắt buộc** cho PR này — lý do: không có file UI mới hay thay đổi visual/journey nào được accept criteria yêu cầu; cả hai refactor chỉ di chuyển state nội bộ ra khỏi file component mà không đổi render output, và review tĩnh (diff đối chiếu + test suite) đủ bao phủ rủi ro.

## Xác minh commit thừa `17c865e7`

Worker tuyên bố commit này chỉ là Prettier formatting trên `notifications.ts`. Đã xác minh độc lập:

- `git show --stat 17c865e7`: chỉ đổi một file, `apps/portal/src/ops/notifications.ts` (+133/-43 dòng).
- So sánh nội dung đã loại bỏ toàn bộ whitespace (`tr -d '[:space:]'` + `fold` để đối chiếu từng đoạn): toàn bộ khác biệt là (a) thêm dấu phẩy cuối (trailing comma) trong lời gọi/khai báo multi-line, và (b) thêm `|` dẫn đầu cho union type multi-line. Không tìm thấy thay đổi identifier, string literal, toán tử, hay logic nào.
- **Kết luận: xác nhận đúng — commit `17c865e7` chỉ là Prettier formatting, không đổi hành vi.**

## Checks đã chạy (độc lập, trên exact SHA `17c865e7`)

Không tái sử dụng kết quả worker — chạy lại từ đầu vì chưa có receipt/log nào trong review worktree trước đó:

| Check                          | Lệnh                                                                                                                                            | Kết quả                                                                                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build workspace deps           | `pnpm --filter @ticket/portal... install --frozen-lockfile`, `pnpm --filter @ticket/contracts build`, `pnpm --filter @ticket/web-session build` | PASS (cần build vì `node_modules`/`dist` trống khi checkout worktree lần đầu — môi trường, không phải lỗi product)                                                          |
| Focused tests                  | `node --test apps/portal/tests/guest-workspace-query.test.ts apps/portal/tests/ops-notification-bff.test.ts`                                    | **PASS 22/22** (12 guest + 10 notification), gồm 4 test case mới: cursor retention, PII rejection (redemption), retry path encoding, idempotency-key reuse theo fingerprint |
| Full Portal suite              | `pnpm --filter @ticket/portal test`                                                                                                             | **PASS 317/317**, 38 suites                                                                                                                                                 |
| Typecheck                      | `pnpm --filter @ticket/portal typecheck`                                                                                                        | PASS, exit 0                                                                                                                                                                |
| Lint                           | `pnpm --filter @ticket/portal lint` (`eslint . --max-warnings 0`)                                                                               | PASS, exit 0                                                                                                                                                                |
| Prettier (7 file đúng phạm vi) | `npx prettier --check <7 files>`                                                                                                                | PASS — "All matched files use Prettier code style!"                                                                                                                         |
| Diff xác nhận phạm vi          | `git diff --stat base..HEAD -- apps/portal`                                                                                                     | Khớp đúng 7 file worker khai báo                                                                                                                                            |

**Kết luận: toàn bộ tuyên bố của worker (317/317, 22/22, typecheck/lint/Prettier PASS) được xác nhận độc lập — không phát hiện sai lệch.**

## Đối chiếu điểm nhạy cảm theo yêu cầu review

- **Tenant/event path escaping:** `notification-commands.ts` giữ nguyên `encodeURIComponent(notificationId)` / `encodeURIComponent(reminderId)` trong `eventPath(...)`; test mới `keeps retry inside the event scope and encodes a supplied identifier` xác nhận ID chứa `/` và `?` được encode đúng.
- **Idempotency fingerprint:** `reminderCreateFingerprint` và `resolveNotificationIdempotencyKey` chuyển verbatim; test mới xác nhận key chỉ tái dùng khi fingerprint không đổi, và gọi `fresh()` đúng 1 lần khi fingerprint đổi.
- **ACCEPTED semantics:** không bị đổi trong phạm vi diff — `providerStatusLabel`/`isProviderStatusFull` ở `notifications.ts` giữ nguyên; comment "ACCEPTED ≠ delivered" không đổi nghĩa.
- **Permissions:** `guest-workspace.tsx` giữ nguyên `allowed` derivation từ `permissions` prop; không có thay đổi route/backend authz trong diff.
- **URL/query:** `buildGuestListQueryPath`, `notificationsListUpstreamPath` không đổi logic query param.
- **Locale:** `t(locale, ...)` calls không đổi message key nào; chỉ đổi line-wrap.
- **Stale response:** `active` flag pattern trong `useGuestListPage` giữ nguyên effect-cleanup logic từ bản gốc trong `guest-workspace.tsx`.
- **Privacy masking:** `requestRow` vẫn chặn `email`/`actorEmail`/`phone`/`token` thô; test mới `rejects redemption rows that contain unmasked personal data` xác nhận hành vi reject khi có `actorEmail` thô song song `actorEmailMasked`.
- **JSX:** không có thay đổi cấu trúc render ngoài việc gọi hook thay vì effect nội tuyến; định dạng JSX chỉ đổi do Prettier.

## Giới hạn và owner tiếp theo

- Review tĩnh (diff + test suite thật chạy trên exact SHA) + CRG impact; không chạy UAT tương tác/browser, không kiểm delivery provider thực tế.
- CI pending/gate: tại thời điểm review, `gh pr checks 1174` đã trả **tất cả job pass** (ci, portal, turbo-persist, changes; các job backend/web/mobile/d5 đang skip theo path filter) — không còn pending, nhưng **quyết định merge gate vẫn thuộc coordinator**, không phải reviewer.
- Không có finding mở cần coordinator xử lý từ phía review này.
