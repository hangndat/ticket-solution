# Production + iOS mới — #859, 24/10/2026

**Trạng thái mới nhất:** web đã nhận hotfix CSS `030436429c89effd3e3b4daef87ddc081233a401` sau baseline `c466343a` bên dưới. iOS build27 đã [upload Internal TestFlight](TESTFLIGHT-UI859-BUILD27-2026-10-24.md). Các checksum/source SHA của lượt phát hành ban đầu bên dưới là bằng chứng lịch sử, không mô tả hai file web sau hotfix.

**Production deploy PASS; local iOS archive/IPA PASS.** Source chung `c466343aeea75c3fe303e8ee885632ec44afce2c`, đã review độc lập và full main CI PASS trước phát hành. User authorize: “deploy prod và build ios mới đi”.

## Production

- VPS `conanphong`, `/opt/vemoki/src/.deploy-sha` = exact source trên. Đã build ngoài cây đang phục vụ, smoke ứng viên rồi chuyển `api`, `worker`, `web`, `portal`. Runtime image/compose/nginx/Keycloak/Postgres container không thay; scopes OIDC admin/platform đã đúng nên không sửa.
- **978/978 file source** khớp checksum checkout đã review. Bỏ qua Markdown/docs/env và hai `next-env.d.ts` do Next build sinh lại; compiled outputs được build trong runtime image hiện hành.
- **21/21 public probes PASS**: marketing/app/portal/API health, wallet/privacy/robots/sitemap, BFF và receipt thiếu auth =401, admin/platform→portal, retired Gate→home308, legacy BFF410, OIDC issuer và login client đúng; vhost ancafe vẫn200. Đây kiểm tra guest/auth boundary, không thay signed-in/device UAT.
- Worker running, startup relay marker PASS. Backup code/dependencies/config và runtime env ở `/opt/vemoki/deploy-backups/ui859-2026-10-24/`; `.env*`, `.data`, `.pnpm-store` được giữ, không seed/reset dữ liệu.
- Lượt đầu rollback tự động tại probe curl từ VPS ra chính public domain bị chờ mạng. Lượt hai dùng TLS loopback `--resolve` và timeout, start đúng từng container: **PASS**; kiểm tra public từ máy ngoài chạy lại PASS sau lượt cuối. Biên nhận giữ cả hai lượt.
- Compose start lượt đầu chạy lại migrate/minio-init theo dependency, cả hai exit0. Migrate đã áp dụng **migration tồn từ trước** `202610211630_epic686_tenant_assets` dù giữa SHA cũ/mới không có schema diff. Nội dung chỉ thêm bảng/index/grants/tenant RLS, không xóa business rows; root xác minh ENABLE+FORCE RLS trên `tenant_assets` PASS. Migration được giữ sau rollback ứng dụng; không rollback DDL. Lượt hai dùng `docker start` bốn app, không chạy lại dependency jobs.

## iOS

- Local prebuild + CocoaPods + Xcode26.5 archive/export, không EAS/cloud. **1.0.0 (27)**, `com.hangndat.ticket`, team `BLUA62D52G`, IPA Apple Distribution, `get-task-allow=false`, `aps-environment=production`, App Store profile không device list.
- Root verify độc lập chữ ký, actual bundle version, production API/OIDC/client, git SHA, tenant/event trống và dev/fixture flags false; native GateKeychainIndex có trong Mach-O. **PASS**.
- IPA: `/Users/admin/SideProject/ticket-solution/release-ui859-ios/apps/mobile/.expo/release-ui859/export/Vemoki.ipa`, **12,263,169 bytes**, SHA256 `f4eb2e71bdaabe0e0edbc4f65b689c66c3ea3731341a1f4047e925babb23d61a`.
- Archive cùng worktree: `apps/mobile/.expo/release-ui859/Vemoki-1.0.0-27-auto.xcarchive`. Source tracked sạch, app.config build26 giữ nguyên; generated Info.plist được đặt27 cho binary lần này. Chưa upload ASC/TestFlight/store; không physical device/pilot acceptance.

## Review và receipts

- Ops review độc lập James/Composer Standard `ctx_51f34432f4d4` PASS với điều kiện backup previous SHA và worker startup; root đã đóng cả hai bằng live evidence. iOS Higo/Composer Standard `ctx_33457cb49d37` hoàn thành, root verify artifact độc lập. Hai dispatch đã collect/release; mailbox ack.
- Logs/JSON/source checksum/scripts: `.orca-metrics/release-ui859/`; ops review `.orca-metrics/REVIEW-DEPLOY-UI859.md`. Không commit binary, secrets hoặc credentials. Worktree iOS giữ để user sử dụng IPA.
- Skill áp dụng: [deploy-prod](../../.cursor/skills/deploy-prod/SKILL.md), [orchestration](/Users/admin/.agents/skills/orchestration/SKILL.md), Expo overview/eas-app-stores (local-Xcode policy override cloud workflow).

Giữ nguyên giới hạn nghiệm thu #859, gồm full M09 crash-inflight/physical APNs, late server POST, PKCE/MFA. Deploy/build thành công không đồng nghĩa pilot ready hay store available. Project #3 chưa sync vì token thiếu read:project.

## Hotfix CSS web sau phát hành

- Source: `030436429c89effd3e3b4daef87ddc081233a401`; chỉ `apps/web/app/globals.css` và `apps/web/src/marketing/marketing-surface.ts`. Khôi phục Preflight sau khi xóa legacy, body font/màu, heading weight và bỏ gạch chân ngoài ý muốn trong header marketing.
- Build production ngoài thư mục đang phục vụ exit0; candidate dùng cấu hình prod, chỉ hai source file khác baseline server. Sáu kiểm tra browser candidate và sáu kiểm tra trên `https://vemoki.com/`, `https://app.vemoki.com/?demo=1`, `https://app.vemoki.com/redeem` ở 1280px/390px PASS: fontBody, margin0, border-box, không tràn ngang, header link không gạch chân.
- Ba route và hai CSS chunk đều HTTP200; chunk chính mới `05gbh0ril60as.css`. Chỉ restart service web. Giữ `.data`/`.env`; backup và marker hotfix ở `/opt/vemoki/backup/web-css-0304364/`. Không đổi bố cục trang hoặc claim signed-in business acceptance.
- Evidence local: `apps/web/.uat-artifacts/prod-css-2026-10-24/deployment-summary.json`, `prod-verification.json` và ảnh `*-prod-1280.png`/`*-prod-390.png` (gitignored). Hotfix được đưa lên nhánh `hangndat/UI-audit` sau đồng bộ `c466343a` bằng cherry-pick `88dc5ca4`; chưa claim đã merge hotfix vào main.
