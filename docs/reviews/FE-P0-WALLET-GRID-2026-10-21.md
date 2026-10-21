# P0 — `/wallet` lưới vé sau redeem (Epic #715)

| Trường | Giá trị |
| --- | --- |
| Epic | [#715](https://github.com/hangndat/ticket-solution/issues/715) |
| Task | `task_c46ab249cc13` |

## Chẩn đoán

| Triệu chứng | Nguyên nhân | Loại |
| --- | --- | --- |
| UAT automation `wallet-ticket-grid` count=0 | Ảnh `wallet-*.png` hiện **`wallet-unreachable`** («Không tải được vé»), không phải `wallet-empty` | **Lỗi code SSR** |
| API smoke `me/tickets` ≥1 | Smoke gọi Nest trực tiếp; nav/account dùng **BFF** (`forwardWithBearer`) | Không mâu thuẫn |
| Map/parse `me/tickets` | Không tới bước parse khi upstream fail-closed `unreachable` | N/A |
| SSR refresh session | `renewOwnerSessionIfPossible` đã có; thiếu **cùng stack upstream** với BFF (timeout, 502 mapping) | **Lỗi code** |

**Kết luận:** Lỗi sản phẩm — `loadOwnerWallet` fetch thẳng `API_BASE_URL` không qua `forwardWithBearer` / `ssrUpstreamGet` như staff discovery và BFF. Không phải seed D9 khi API smoke pass.

## Sửa

1. `ssrUpstreamGet` trong `src/bff/upstream.ts` — SSR GET với `allowCookieRefresh: false`.
2. `loadOwnerWallet` dùng helper trên (production); test vẫn inject `fetchImpl`.
3. Retry một lần khi upstream `502`/`503` trên `me/tenants` và `me/tickets`.
4. Harness `apps/web/tests/fe-p0-wallet-grid-uat.mjs` — redeem **mã riêng / viewport**, chờ `wallet-ticket-grid`.

## Checks

```bash
pnpm --filter @ticket/contracts build && pnpm --filter @ticket/web-session build
pnpm --filter @ticket/web lint && pnpm --filter @ticket/web typecheck && pnpm --filter @ticket/web test
```

## UAT ảnh (stack D9)

```bash
# WEB_UAT_REDEEM_CODE_DESKTOP / WEB_UAT_REDEEM_CODE_MOBILE — hai mã DEMO-MFEST-xxx chưa dùng
WEB_BASE_URL=http://localhost:3000 node apps/web/tests/fe-p0-wallet-grid-uat.mjs
```

Artifacts: `docs/reviews/assets/fe-p0-wallet-grid-uat/`
