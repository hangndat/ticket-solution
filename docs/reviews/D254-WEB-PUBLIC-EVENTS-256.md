# Evidence — Web public events từ server (#256 / ADR-19)

| Trường | Giá trị |
| --- | --- |
| Scope | `apps/web` only · Issue [#256](https://github.com/hangndat/ticket-solution/issues/256) · Epic [#254](https://github.com/hangndat/ticket-solution/issues/254) |
| PR | [#268](https://github.com/hangndat/ticket-solution/pull/268) |
| Branch | `hangndat/d254-web-public-events` |
| Tip SHA | `d2e58c0f11d6af74596967f849796cd673b4b430` |
| Hard dep | PR #261 merge SHA `b099ce43caea0a51e095e675b3bfbbde47bcb8fa` |
| Implementer | Orca web worker · Role `web` · Dispatch `ctx_dec187b56576` |
| Architecture impact | Có — consumer ADR-19 |

## Thay đổi

1. BFF list proxy: `GET /api/bff/public/tenants/{tenantSlug}/events` → Nest public list.
2. Module `apps/web/src/published/*`: parse fail-closed + SSR/ISR loaders (Nest trực tiếp, `revalidate=60`).
3. Home `/` + `/t/.../events/...` đọc published projection; bỏ `generateStaticParams` / `dynamicParams=false` gắn fixture.
4. Empty / unreachable / invalid / not-found: `SurfaceState` VI (PD handoff `docs/design/event-server-source/` chưa có trên main — bám BA/architect).
5. Fixture SoT archive: `src/fixtures/archived-demo-events.ts`; `events.ts` không còn `findDemoEvent`.
6. Media: ưu tiên `brand.logoUrl` / `bannerUrl`; pack demo chỉ khi id/slug seed tường minh + nhãn `· Demo`.

## Checks (implementer)

```bash
pnpm --filter @ticket/contracts build
cd apps/web && pnpm exec tsx --test \
  tests/published-events.test.ts \
  tests/published-api.test.ts \
  tests/events.test.ts \
  tests/demo-media.test.ts
# → 17 pass
cd apps/web && pnpm typecheck
# → pass
```

## UAT

- Nest local `127.0.0.1:3001` **không** chạy trong session → chưa chạy `scripts/web-uat.sh`.
- Unit + typecheck đủ evidence consumer path; headless UAT khi API+seed sẵn sàng.

## Acceptance map

| AC | Kết quả |
| --- | --- |
| Không import `findDemoEvent` trên đường public chính | Đạt (`app/page.tsx`, event page) |
| BFF list + detail | Đạt |
| Không fallback fixture khi API lỗi | Đạt (`unreachable` / `invalid` SurfaceState) |
| Prefer published media URLs | Đạt |

## Limitations

- Home tenant entry: `PUBLIC_HOME_TENANT_SLUGS` (default `demo-fun,demo-studio`) — không invent global marketplace.
- DoD PASS cần reviewer độc lập trên exact tip SHA sau push/PR.
