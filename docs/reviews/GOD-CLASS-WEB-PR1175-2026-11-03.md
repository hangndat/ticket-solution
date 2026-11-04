# PR #1175 — revalidation tích hợp Web redemption

- Reviewer: James (reviewer-merged), độc lập với Linh. Base `9993d354ef1e2dda8835175ceee24e5b28389466`; HEAD chính xác `c17f4c26b34b5a00bc795811998f43f9507982af`.
- CRG tại đúng worktree/HEAD: build và stats 1.620 files, 10.120 nodes; query `file_summary` dùng path cũ không khớp, sau đó xác định path thật bằng LeanCTX compose. Diff PR gồm bốn path Web: form, owner refresh TS/MD, scope tests.

## Kết luận

- **DoD: PASS ở mức source/integration review.** Boundary `refreshOwnerRedemption` sở hữu fetch, kiểm generation, diễn giải status và lập state plan; form chỉ áp outcome. Blocker F01 của baseline report `GOD-CLASS-WEB-REDEEM-2026-11-03.md` đã đóng. `git diff --check` PASS. Worker báo suite Web 333/333, typecheck, lint, Prettier PASS trên SHA này; chưa có receipt độc lập nên ghi nhận là reused, không coi là check reviewer đã chạy.
- **Security: PASS ở mức source review.** Owner fetch giữ tenant scope qua BFF bearer và API owner endpoint; 401/403 không tạo ticket plan; stale response bị loại. Idempotency/replay, resolve token và queued/retry nằm ngoài logic đổi hành vi của diff.
- **UI/UX: PASS ở mức code review.** Locale message được truyền vào helper; pending giữ request, rejected/expired xóa pending, issued tạo active ticket. JSX diff chỉ là format/reflow; không thấy đổi nhánh render hay class. Không cần viewport probe mới cho visual/journey không đổi; chưa xác nhận bằng browser runtime.

## Tích hợp và giới hạn

`main` đã tới `fa96e7db`; delta từ base chạm `apps/web/app/robots.ts`, `sitemap.ts`, `next.config.ts`, không chạm form, owner helper hoặc BFF status route. Những thay đổi host/proxy/SEO này không cho thấy thay đổi redemption contract trong diff path; coordinator cần chốt CI/merge trên merge result. Không có finding mở từ review này. CI watcher và merge là gate của coordinator; nếu CI thất bại hoặc merge result đổi redemption path, revalidate SHA mới.
