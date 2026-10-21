# P0 — `/wallet` + `/account` session (2026-10-21)

| Trường | Giá trị |
| --- | --- |
| Epic | #715 wave 2 |
| Task | `task_5193851b5064` |
| Branch | `hangndat/fe-web-p0-wallet-session` |

## Chẩn đoán

| Triệu chứng | Nguyên nhân | Loại |
| --- | --- | --- |
| «Không tải được phiên» sau login trên `localhost` khi `.env` redirect `127.0.0.1` | Callback set cookie trên `127.0.0.1` nhưng redirect post-login về `WEB_PUBLIC_ORIGIN` (`localhost`) → cookie jar tách | **Môi trường / cấu hình** |
| «Không tải được vé» với API tắt | `loadOwnerWallet` gọi Nest trực tiếp → `unreachable` | **Môi trường** |
| Đã login, access hết hạn, `/account` OK (BFF refresh) nhưng `/wallet` lỗi / cần login | SSR wallet không gọi refresh route như `/gate` | **Lỗi code** |

## Sửa

1. `requireSessionRedirectOrigin` — redirect sau OIDC giữ host request (127.0.0.1 vs localhost).
2. `renewOwnerSessionIfPossible('/wallet')` — refresh SSR khi có refresh cookie.
3. Thông báo lỗi account/wallet hướng dẫn API + single origin.
4. `.env.example` + README: `OIDC_REDIRECT_URI` = `http://localhost:3000/...`.

## Checks

```bash
pnpm --filter @ticket/web lint
pnpm --filter @ticket/web typecheck
pnpm --filter @ticket/web test
```

UAT (stack local): `http://localhost:3000`, `attendee@example.com` / `attendee-demo`, D9 seed — `/wallet` lưới vé, `/account` phiên signed-in.
