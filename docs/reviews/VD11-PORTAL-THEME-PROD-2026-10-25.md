# VD11 — Portal P-F05 theme-only production follow-up

**Ngày:** 2026-10-25 · **Source:** `76a015c58202bcc7faa885ab1f15106f54751dcd` trên `hangndat/vd11-portal-theme-release` · **Scope:** riêng `apps/portal` theme. User đã hủy cache tổ chức/sự kiện; ứng viên bắt đầu từ `5f00dc9e` trước mọi commit cache. Nhánh tích hợp cũng đã gỡ mã cache.

## Gate

- [Review độc lập ban đầu](VD11-PORTAL-P05-INDEPENDENT-REVIEW-2026-10-25.md) tại `569243ed`: DoD/UI PASS. [Revalidation](VD11-PORTAL-P05-REVALIDATION-2026-10-25.md) tại exact source `76a015c5`: DoD/UI PASS. Reviewer James khác implementer Linh/coordinator.
- Release checkout: `pnpm --filter @ticket/portal test` PASS (169 test), `typecheck` PASS, `build` PASS; eslint hai file theme thay đổi PASS. Build workspace dependencies `@ticket/contracts` và `@ticket/web-session` trước test. Local OIDC Owner trên `:3334`: popup tổ chức nền `rgb(255,255,255)`, chữ `rgb(23,32,57)`, selected `rgb(246,240,255)`; sidebar `rgb(11,16,39)`. Reviewer đo thêm 390/1440 và dropdown sự kiện/tài khoản.
- Reduced motion: source nested `ConfigProvider inherit:false` giờ nhận lại ba motion duration `0s` khi OS báo `prefers-reduced-motion: reduce`. Orca chưa emulate được trạng thái OS này; reviewer ghi giới hạn, không suy ra runtime proof.

## Triển khai

1. Backup trước thay: `/opt/vemoki/backup/vd11-portal-followup-20261025/pre-portal.tgz` (tar đọc được). Chỉ ba file runtime theme khác baseline production `8421bcaf`; rsync dry-run và checksum 3/3 giữa release checkout ↔ candidate ↔ live đều khớp.
2. Build ngoài live trong `/opt/vemoki/src/apps/portal-vd11-theme-buildtest-76a015c5` bằng container Portal hiện hành, build exit 0. Candidate smoke nội bộ: `/auth` 200, `/api/bff/me/tenants` 401, `/api/auth/login` 307.
3. Hoán đổi cây Portal, di chuyển `.env` hiện hành vào cây mới, đưa bản cũ tới `/opt/vemoki/src/.vd11-rollback-theme-76a015c5/portal`; restart **chỉ** `portal`. Build ID live: `qmzwZS2Wnkb9rgM6lqZmk`. Không cài dependency, không đổi root lock/shared packages/DB/web/iOS.
4. Public smoke: `https://portal.vemoki.com/auth` 200; staff/platform discovery không cookie 401/401; login 307; `https://vemoki.com/` 200; API health 200. Container Portal `running`. Marker `/opt/vemoki/vd11-deployed-runtime.json` giữ web metadata và thêm `portalThemeFollowup` với source, backup, rollback, build ID.

## Trạng thái và rollback

P-F05 **acceptance complete** trong scope theme Portal; không tuyên bố pilot ready toàn dự án. Authenticated UI được xác minh qua OIDC local synthetic; không dùng credential production để kiểm private flow. Không push/PR.

Sau UAT đã đóng bốn tab agent/reviewer tạo trong worktree VD11, xóa browser profile OIDC synthetic, gỡ đúng callback/origin local3334 đã thêm, xóa Keycloak user và membership/assignment synthetic, rồi xóa private receipts. Giữ server local3334 phục vụ dev/review; auth local cần khai báo lại callback nếu tái kiểm.

Nếu cần rollback: bảo toàn `.env`/`.data` mới nhất từ `apps/portal`, đưa cây live lỗi ra ngoài `apps/`, chuyển `/opt/vemoki/src/.vd11-rollback-theme-76a015c5/portal` về `apps/portal`, trả `.env`/`.data` mới nhất, rồi `docker compose --env-file /opt/vemoki/.env -f /opt/vemoki/src/infra/deploy/compose.yaml restart portal`. Không restore snapshot `.data` cũ đè trạng thái phát sinh sau deploy.
