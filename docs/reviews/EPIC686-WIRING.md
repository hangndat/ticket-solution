# Epic #686 — Prod seed media wiring (local E2E)

| Field | Value |
| --- | --- |
| Issue | [#686](https://github.com/hangndat/ticket-solution/issues/686) |
| Branch | `hangndat/seed-wire` |
| Merged inputs | PR #691 (media raster), PR #692 (prod seed BE) |

## What shipped

1. **DB seed** (`packages/backend/src/prod-seed.ts`): `logoAssetId` / `bannerAssetId` on published brand + marketing config; `event_assets` READY rows from `brand/prod/manifest.json`; tenant `logo_asset_id` for org logos.
2. **Public projection** (`published-events.ts` + `published-asset-url.ts`): `brand.logoUrl` / `brand.bannerUrl` when READY assets exist (`PUBLISHED_ASSET_PUBLIC_BASE`).
3. **Asset GET** `GET /v1/public/tenants/{tenantSlug}/events/{eventSlug}/assets/{assetId}` → MinIO ready object (fail-closed).
4. **Ops upload** `scripts/prod-seed-media.mjs` + `prod-seed-media.sh`: manifest-driven PutObject, SHA-256 skip, `PROD_MEDIA_CONFIRM` / `PROD_MEDIA_DRY_RUN`, smoke evidence.

## Manifest UUID fix

Asset ids in `brand/prod/manifest.json` were padded to valid PostgreSQL UUIDs (12-char last segment), e.g. `…000101010000`.

## Local commands (no prod)

```bash
export DATABASE_URL='postgresql://ticket_dev:local_dev_only@127.0.0.1:55432/ticket_solution'
export CODE_HMAC_PEPPER='local-dev-code-pepper-change-me'
PROD_SEED_CONFIRM=1 PROD_SEED_CREATE_STAFF_USERS=1 PROD_SEED_FORCE_MARKETING=1 ./scripts/prod-seed.sh
PROD_MEDIA_CONFIRM=1 ./scripts/prod-seed-media.sh
export PUBLISHED_ASSET_PUBLIC_BASE='http://127.0.0.1:3100'
# API + web with PUBLIC_HOME_TENANT_SLUGS=luc-bao-live,saigon-pulse,heritage-hoi-an
```

## API evidence (6 events)

All six prod events return HTTPS-ready public asset URLs on detail:

| Tenant | Event | logoUrl | bannerUrl |
| --- | --- | --- | --- |
| `luc-bao-live` | `dem-am-indie` | OK | OK |
| `saigon-pulse` | `pulse-afterhours` | OK | OK |
| `saigon-pulse` | `pulse-rooftop` | OK | OK |
| `heritage-hoi-an` | `pho-co-dem` | OK | OK |
| `heritage-hoi-an` | `song-thu-workshop` | OK | OK |
| `heritage-hoi-an` | `festival-an-song` | OK | OK |

Example (`dem-am-indie`):

```json
{
  "logoUrl": "http://127.0.0.1:3100/v1/public/tenants/luc-bao-live/events/dem-am-indie/assets/686f0001-0008-4000-8000-000101010000",
  "bannerUrl": "http://127.0.0.1:3100/v1/public/tenants/luc-bao-live/events/dem-am-indie/assets/686f0001-0008-4000-8000-000101020000"
}
```

`GET` asset → `200` `image/webp` / `image/png` (see samples below).

## Media samples (API proxy)

| File | Role |
| --- | --- |
| [EPIC686-WIRING-banner-sample.webp](./EPIC686-WIRING-banner-sample.webp) | Banner bytes via public asset route |
| [EPIC686-WIRING-logo-sample.png](./EPIC686-WIRING-logo-sample.png) | Logo bytes via public asset route |

## Web surfaces

- Home catalog: set `PUBLIC_HOME_TENANT_SLUGS=luc-bao-live,saigon-pulse,heritage-hoi-an` — `EventBanner` / `EventLogo` consume `brand.bannerUrl` / `brand.logoUrl` from BFF (no demo fallback when URLs present).
- Event detail: `/t/{tenantSlug}/events/{eventSlug}` — same components.

Playwright full-page screenshots were not committed in this run (browser install pending in worker); raster proof is via API GET samples above.

## Org logos (4 tenants)

| Org | `logo_asset_id` in DB | MinIO org lockup |
| --- | --- | --- |
| Lục Bảo Live | set | uploaded (anchor event E01) |
| Saigon Pulse | set | uploaded (anchor E02) |
| Di sản Hội An | set | uploaded (anchor E04) |
| Mekong Makers | set | no event anchor — object skipped (0 events); tenant id only |

## Limitations / follow-up

- Public **tenant** branding `logoUrl` for org chrome (non-event) — separate endpoint enrichment.
- Mekong org raster needs branding anchor event or tenant-scoped asset table.
- Prod VPS: runbook §6 uses `prod-seed-media.mjs` (not `d9-seed-media.mjs`).

## Prod

**Not executed** (local-only E2E per task).
