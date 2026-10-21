# FE UAT stack runner — chênh lệch môi trường vs Epic #715 UAT worker

| Trường | Giá trị |
| --- | --- |
| **Epic** | #715 (task tooling, không đóng Issue trong PR) |
| **SHA evidence** | tip branch `hangndat/fe-uat-stack-runner` sau bootstrap local |
| **Script** | `./scripts/fe-uat-stack.sh` |

## Tóm tắt

Reviewer PR #741–#747 và UAT rerun (`fe-uat-rerun`) chụp được `admin-workspace`, `gate-tabs`, `wallet-ticket-grid` và surface redeem có điều khoản. UAT worker wave 3 (`fe-uat-final3`) báo thiếu cả bốn trên stack tự dựng — **không tái lập được trên product khi bootstrap/seed/env đúng**; nguyên nhân là **thứ tự bootstrap + biến môi trường + build web**, không phải regression UI trên `main`.

## Khác biệt môi trường (reviewer / smoke vs UAT worker)

| Hạng mục | Reviewer / `d9-demo-seed-smoke` | UAT worker (final3) | Hậu quả |
| --- | --- | --- | --- |
| DB runtime | `d9-demo-bootstrap-db.mjs` → `d9_demo_rt` + `ticket_platform_runtime` | Seed trên DB trống nhưng API có thể dùng `ticket_dev` hoặc role thiếu platform grant | `GET /v1/public/*` / BFF public → 500; schema redeem không tải → **không** `redeem-terms-consent` |
| Seed subjects | `D9_DEMO_STAFF_SUBJECT` / `D9_DEMO_ATTENDEE_SUBJECT` từ token Keycloak (smoke) | Chỉ `./scripts/d9-demo-seed.sh` (subject fixture) + login web sau seed | Staff OIDC `sub` ≠ membership row → `/admin` / `/gate` ≈ deny (final3) |
| HMAC / credentials | `CODE_HMAC_PEPPER` + `TICKET_CREDENTIAL_KEY` khớp seed và API | Thiếu hoặc lệch pepper | Redeem API fail; ví trống |
| Global redeem | `SINGLE_CODE_RESOLVE_GLOBAL` + `NEXT_PUBLIC_SINGLE_CODE_RESOLVE` (tùy URL) | `/redeem` không query → luồng một mã phase `enter-code` (không fieldset terms) | Playwright chờ `redeem-terms-consent` timeout (final3) |
| Web build | `pnpm --filter @ticket/web-session build` trước `next dev` | `next dev` trên worktree chưa build `@ticket/web-session` | Trang 500, không marker UI |
| `pnpm install` | Có | Worktree runner thiếu `node_modules` | API smoke / build fail sớm |

## Chứng minh stack sạch (local, script mới)

Sau `./scripts/fe-uat-stack.sh bootstrap` + API `:3001` + web `:3000` (env từ `print-env`):

| Marker | Kết luận |
| --- | --- |
| `redeem-terms-consent` | **Môi trường** khi BFF public + tenant-bound `?tenantSlug=mfest-demo&eventSlug=mfest`; UAT rerun đã thấy copy lỗi consent (sản phẩm đúng khi terms hiện). Harness `check-ui` cần URL slug + OIDC `return` path-only. |
| `wallet-ticket-grid` | **Môi trường** — cần redeem API thành công (pepper + seed); **PASS** `check-ui` khi stack đúng. |
| `admin-workspace` | **Môi trường** — seed với Keycloak `sub` + session staff; **PASS** `check-ui`. |
| `gate-tabs` | **Môi trường** — cùng staff session + `me/events`; **PASS** `check-ui`. |

`./scripts/fe-uat-stack.sh check-api`: public `terms-v1`, staff admin/gate capability, redeem + `me/tickets` — **PASS**.

## Verdict theo hạng mục (Epic #715 P0/P1)

| Hạng mục | Lỗi môi trường | Lỗi sản phẩm |
| --- | --- | --- |
| redeem-terms-consent | Có (bootstrap role, BFF, URL redeem, web-session build) | Không trên SHA hiện tại khi stack chuẩn |
| wallet-ticket-grid | Có (redeem fail downstream) | Không |
| admin-workspace | Có (seed subjects / staff session) | Không |
| gate-tabs | Có (staff capability / API down → loading) | Không (rerun P1 loading = discovery chậm/API) |
