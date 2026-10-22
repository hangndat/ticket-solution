# Redeem terms consent — UAT final4 vs harness (Epic #715)

| Trường | Giá trị |
| --- | --- |
| **Epic** | #715 (không đóng Issue trong PR) |
| **UAT báo cáo** | `fe-uat-final4` — `FE-REFACTOR-FINAL-UAT-4-2026-10-22.md` |
| **SHA điều tra** | `origin/main` `c27eee34` |

## Kết luận

**Chủ yếu harness / OIDC return (không phải regression redeem terms từ #747 trên `main`).**

1. **`sanitizePostLoginPath`** đã **bỏ query** trên `/redeem` — attendee login với `?tenantSlug=&eventSlug=` bị đưa về `/redeem` thuần → với `NEXT_PUBLIC_SINGLE_CODE_RESOLVE=1` UI là **global enter-code** (không có `redeem-terms-consent` cho đến sau bước resolve mã).
2. Harness `check-ui` chờ `redeem-terms-consent` **ngay sau login** mà không fallback resolve mã global; không tách mã API (`DEMO-MFEST-003`) vs UI → `CODE_CONSUMED`.
3. `print-env` thiếu `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` → `/api/auth/login` **503** trong một số phiên worker.

**Sửa sản phẩm nhỏ (hardening, không nới enforcement terms):**

- Giữ `tenantSlug` / `eventSlug` / UUID scope an toàn trên return OIDC `/redeem`.
- Auto-load published schema theo **cặp slug** (tránh `autoLoadedSlugRef` boolean chặn tải lại khi slug đổi sau login).

UAT final4 thấy «Chưa có biểu mẫu» + BFF public **200** khớp **schema client chưa hydrate** sau login mất slug hoặc chưa auto-load — không tái lập lỗi pepper/seed API (`check-api` PASS).

## Evidence local (worker)

- API/BFF: `terms-v1`, `form: null` — `parsePublishedRedeemSchema` hợp lệ.
- Login sau fix: return URL giữ `tenantSlug=mfest-demo&eventSlug=mfest`.
- Ảnh harness (dev `next dev` kẹt `route-loading` trong Playwright — môi trường): `docs/reviews/assets/fe-redeem-terms-harness-2026-10-22/`.

## Checks

- `pnpm --filter @ticket/web` lint + typecheck + test: **PASS**
- `test:routes` cần `next build` production (build hiện fail prerender `/invite` trên worktree — limitation phiên worker).
