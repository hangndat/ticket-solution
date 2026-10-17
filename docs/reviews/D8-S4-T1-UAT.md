# D8-S4-T1 — UAT headless multi-tenant branding

**Issue:** [#131](https://github.com/hangndat/ticket-solution/issues/131) · Story [#130](https://github.com/hangndat/ticket-solution/issues/130) · Epic [#119](https://github.com/hangndat/ticket-solution/issues/119)  
**Ownership:** web (+ sim-uat iOS) · **không** EAS Cloud Build · **không** computer-use chuột desktop  
**Branch:** `hangndat/d8-s4-t1-uat`  
**Main tip verified:** `f60b64383e5ae70bdb73d14c6b05c1e8dacb4393`  
**Evidence commit:** tip of this branch / PR (docs + curated sim screenshots; see PR tip SHA)

## Fixtures (≥2 tenants)

| Surface | Tenant fixture | Branding signal |
| --- | --- | --- |
| Web event | `sunburst` / `fun-fest-2026` | Wordmark **sunburst collective**, org **Sunburst Collective**, theme warm / `#783013` |
| Web event | `northline` / `form-forum-2026` | Wordmark **northline studio**, org **Northline Studio**, theme mint / `#154c42` |
| iOS Events | `demo-fun` | Label `Tenant: demo-fun` · `Demo FUN Collective` · demo card brand accent |
| iOS Events | `demo-studio` | `Demo · Tổ chức: demo-studio` · **Demo Studio Organization** · purple card accent |

Platform chrome (`/`, `/admin`, `/gate`) vẫn dùng Vemoki mặc định cho đến khi có tenant slug trong `ThemeProvider` — xem `docs/reviews/d8-web-uat-notes.md`.

## Web — Playwright headless (`scripts/web-uat.sh`)

```bash
pnpm install --frozen-lockfile
pnpm --filter @ticket/contracts build
cd apps/web && pnpm exec next dev --port 3010   # :3000 occupied elsewhere

WEB_BASE_URL=http://127.0.0.1:3010 \
  ./scripts/web-uat.sh screenshot http://127.0.0.1:3010/ \
  apps/web/.uat-artifacts/d8-s4-t1/d8-home.png

WEB_BASE_URL=http://127.0.0.1:3010 \
  ./scripts/web-uat.sh screenshot \
  http://127.0.0.1:3010/t/sunburst/events/fun-fest-2026 \
  apps/web/.uat-artifacts/d8-s4-t1/d8-event-sunburst.png

WEB_BASE_URL=http://127.0.0.1:3010 \
  ./scripts/web-uat.sh screenshot \
  http://127.0.0.1:3010/t/northline/events/form-forum-2026 \
  apps/web/.uat-artifacts/d8-s4-t1/d8-event-northline.png
```

| Check | Result |
| --- | --- |
| `/` | HTTP 200 · title `Vemoki` |
| `/t/sunburst/events/fun-fest-2026` | HTTP 200 · title `FUN FEST 2026 — Sunburst Collective · Vemoki` |
| `/t/northline/events/form-forum-2026` | HTTP 200 · title `Form & Forum — Northline Studio · Vemoki` |
| BFF `GET /api/bff/public/tenants/unknown-tenant/branding` | JSON `source=vemoki-default`, `wordmark=vemoki`, `primaryColor=#9b3a18` |
| BFF `…/tenants/sunburst/branding` (no local API) | `source=vemoki-default`, `upstreamStatus=502` (fail-closed Vemoki) |

- Launcher: cached `chrome-headless-shell` (không mở Chrome.app)
- Originals (gitignored): `apps/web/.uat-artifacts/d8-s4-t1/`
- Curated (tracked): [`d8-uat/web/`](./d8-uat/web/) — re-captured on tip; PNG bytes match prior main assets for home + 2 tenant events (branding unchanged)

| Surface | File |
| --- | --- |
| `/` | ![d8-home](./d8-uat/web/d8-home.png) |
| Demo sunburst | ![d8-event-sunburst](./d8-uat/web/d8-event-sunburst.png) |
| Demo northline | ![d8-event-northline](./d8-uat/web/d8-event-northline.png) |
| `/admin` (prior chrome) | ![d8-admin](./d8-uat/web/d8-admin.png) |
| `/gate` (prior chrome) | ![d8-gate](./d8-uat/web/d8-gate.png) |

## iOS Simulator — `scripts/sim-uat.sh` (AXe HID + simctl)

```bash
export SIM_UDID=F191CF59-4B73-44E5-BFA8-4CE439EB31AD
scripts/sim-uat.sh boot "$SIM_UDID"          # không open -a Simulator
scripts/sim-uat.sh launch com.hangndat.ticket
scripts/sim-uat.sh tap --label "Sự kiện" --udid "$SIM_UDID"
scripts/sim-uat.sh screenshot "$SIM_UDID" \
  apps/mobile/.uat-artifacts/d8-s4-t1/d8-sim-tenant-demo-fun.png
scripts/sim-uat.sh tap --label "Đổi tổ chức demo" --udid "$SIM_UDID"
scripts/sim-uat.sh screenshot "$SIM_UDID" \
  apps/mobile/.uat-artifacts/d8-s4-t1/d8-sim-tenant-demo-studio.png
```

- Device: iPhone 17 Pro · UDID `F191CF59-4B73-44E5-BFA8-4CE439EB31AD`
- App local: `com.hangndat.ticket` (Vemoki) — **không** EAS Cloud Build
- Originals (gitignored): `apps/mobile/.uat-artifacts/d8-s4-t1/`
- Curated (tracked): [`d8-uat/ios/`](./d8-uat/ios/)

| Surface | File |
| --- | --- |
| Events · demo-fun | ![demo-fun](./d8-uat/ios/d8-sim-tenant-demo-fun.png) |
| Events · demo-studio | ![demo-studio](./d8-uat/ios/d8-sim-tenant-demo-studio.png) |

## Limitations / known gaps

- Event-page branding trên web lấy từ fixture `brandingFromEventBrand` (wordmark/theme per tenant). Public BFF branding GET cần API upstream; không có API → Vemoki fallback (`upstreamStatus=502`) — đúng fail-closed.
- `/admin` / `/gate` phụ thuộc BFF/API; không refresh screenshot chrome trong lần chạy này (giữ curated prior).
- Sim: `Tenant:` slug published API có thể còn `demo-fun` trong khi demo org card đã đổi sang **Demo Studio Organization** (nút «Đổi tổ chức demo»); đủ để chứng minh ≥2 tenant fixture branding trên sim.
- Headless only — không device UAT vật lý. Không deploy prod trong task này.

## Acceptance map (#131)

| Criterion | Evidence |
| --- | --- |
| ≥2 tenant web branding screenshots | sunburst + northline event PNGs + HTTP 200 titles |
| Sim screenshots (feasible) | demo-fun + demo-studio curated iOS PNGs |
| Exact SHA + commands | this file + PR tip |
| No EAS / headless only | Playwright headless-shell + sim-uat AXe |
