# Epic #686 — DoD + Security review (backend stack PR #699)

| Field | Value |
| --- | --- |
| Epic | [#686](https://github.com/hangndat/ticket-solution/issues/686) |
| PR reviewed | [#699](https://github.com/hangndat/ticket-solution/pull/699) (stack tip; contains #692 `bc1524e`, #695 `7ee7016`) |
| Exact SHA | `85780f8868d1b81509cabe547b38368172e9c085` |
| Reviewer | Orca worker `task_d4bb4f2932d4` (independent; no feature edits) |
| Verdict | **PASS with known gap** |

## CI (GitHub)

```text
./scripts/gh-dod-evidence.sh 699
head.sha=85780f8868d1b81509cabe547b38368172e9c085
state=open mergeable=true
backend, web, portal, mobile, changes — completed success
database-isolation shards (incl. demo-seed-rebrand, minio-real, rls, published-events) — completed success
```

## Scope exercised

- Prod seed guards, idempotency, HMAC redemption storage
- `tenant_assets` migration + RLS
- Public tenant branding + tenant-scoped asset proxy (MinIO)
- `scripts/prod-seed-media.mjs` upload guards
- Staff membership (ADR-21)
- Merge trial: PR #699 tip + `origin/hangndat/tenant-logo` (#697 brand/prod)

## Local verification

| Check | Command / setup | Result |
| --- | --- | --- |
| Idempotent seed (isolated PG) | `packages/backend`: `node --test test/prod-seed-idempotent.test.cjs` | PASS — 2× `seedProdDataset`, second run `codesInserted=0`, skips ≥ first insert |
| Unit guards | `test/prod-seed-unit.test.cjs` | PASS — `assertProdSeedMutateAllowed` rejects missing/`0` confirm |
| Manifest resolver | `test/prod-media-manifest.test.cjs` | PASS — `tenants[].logo` preferred over `tenantBrand.logo` |
| Public branding | `test/public-tenant-branding.test.cjs` | PASS — Mekong `logoUrl` when `tenant_assets` READY |
| Compose PG 2× seed | `127.0.0.1:55432` after applying `202610211630_epic686_tenant_assets`; `PROD_SEED_CONFIRM=1` + `PROD_SEED_CREATE_STAFF_USERS=1` ×2 | PASS — both runs `codesInserted=0`, `codesSkipped=60`, `configsSkipped=6` (fixture already present) |
| `PROD_SEED` shell guard | `./scripts/prod-seed.sh` without confirm/dry-run | exit 2 (refuse) |
| `PROD_MEDIA` guard | `node scripts/prod-seed-media.mjs` | exit 1 — requires `PROD_MEDIA_CONFIRM=1` or dry/smoke |

Prod VPS seed/media **not** executed (per runbook).

## Security findings

### PASS — seed / ops guards

- `packages/backend/src/prod-seed.ts:381-391` — `assertProdSeedMutateAllowed`: mutate requires `PROD_SEED_CONFIRM=1|yes`; `PROD_SEED_DRY_RUN` is the only bypass (intended rollback path).
- `packages/backend/src/prod-seed.ts:364-378` — `assertProdSeedDatabaseHostAllowed` blocks `*.vemoki.com` and known prod hostnames.
- `scripts/prod-seed.sh:23-26` — second refuse layer before CLI.
- `packages/backend/scripts/prod-seed.cjs:19-29` — CLI applies host + confirm checks; no logging of `CODE_HMAC_PEPPER`.
- Redemption codes stored via `hashRedemptionCode` (`code-hmac`); CLI output is JSON tallies only — no raw `VEM-*` in logs reviewed.

### PASS — public tenant branding / assets (tenant isolation, no SSRF)

- `packages/backend/src/public-tenant-branding.ts:34-37` — invalid slug → `null` (404 at API).
- `packages/backend/src/published-tenant-asset.ts:32-34` — slug + UUID format gate.
- `packages/backend/src/published-tenant-asset.ts:40-50` — asset must equal `tenants.logo_asset_id` for resolved tenant (fail-closed; blocks arbitrary UUID → object).
- `packages/backend/src/published-tenant-asset.ts:59-78` — `ready_key` loaded only from `tenant_assets` under `withTenant`; `getObject(minio, row.ready_key)` — no user-controlled object key / path traversal.
- `packages/backend/src/published-event-asset.ts:64-72` — event assets limited to published brand snapshot logo/banner IDs (same pattern as prior wiring PR).
- Rate limiting on public read controllers (`apps/api/src/public-tenant-branding.ts:68-74`, `published-tenant-assets.ts:59-66`).

### PASS — migration `tenant_assets`

- `packages/backend/prisma/migrations/202610211630_epic686_tenant_assets/migration.sql` — `CREATE TABLE` + index + RLS policy; **no** `ALTER`/`DROP` on existing tenant data tables; safe on populated DB (additive only).

### PASS — staff membership (no privilege inflation in prod path)

- `packages/backend/src/prod-seed.ts:3-4` (module doc) + grant loop ~`1086`/`1135` — membership only for existing `users` by plus-address email; `createMissingStaffUsers` gated on `PROD_SEED_CREATE_STAFF_USERS=1` (tests/local only).

### PASS — media upload script

- `scripts/prod-seed-media.mjs:222-229` — `PROD_MEDIA_CONFIRM` required for PUT; dry-run/smoke paths explicit.
- Upload plan uses manifest `contentType` + sha256 idempotent skip (`putObject` only when remote hash differs).

### Low / follow-up (not blocking #699)

| Item | Location | Note |
| --- | --- | --- |
| No dedicated cross-tenant negative test for `readPublishedTenantAsset` | — | Logic reviewed; recommend adding test mirroring event-asset IDOR cases. |
| Upload does not sniff image magic bytes at runtime | `scripts/prod-seed-media.mjs:buildPlan` | Trusts repo manifest + build pipeline; acceptable for ops script, document in runbook. |

## Merge trial #699 + #697 (`hangndat/tenant-logo`)

- Git merge `review-pr-699` + `origin/hangndat/tenant-logo`: **clean** (binary brand assets + expanded manifest).
- **Schema drift (known gap):**
  - **#697** manifest uses `tenantBrand.assets[]` (mark, lockup, tiles, multiple roles) and shorter logo `assetId` form in its branch history (e.g. `…00000101`).
  - **#699** resolver/upload uses `tenantOrgLogoAsset` → `tenant.logo ?? tenantBrand.logo` only (`packages/backend/src/prod-media-manifest.ts:124-130`, `scripts/prod-seed-media.mjs:176-177`).
  - After merge, merged `brand/prod/manifest.json` retains `tenantBrand.assets` (10 entries on luc-bao-live) **but** seed/media upload still ingests **one** org logo per tenant; mark/lockup/tile variants are **not** uploaded or exposed.
- **Recommendation before integrating #697 on main:** extend `buildPlan` + `tenantOrgLogoAsset` (or shared iterator) to walk `tenantBrand.assets` with stable `assetId`s aligned to `PROD-SEED-DATASET.md`, or collapse #697 manifest to logo-only until consumer exists. Re-run `prod-seed-media` smoke after manifest unification.

## Stacked commits cited

| PR | SHA | Role |
| --- | --- | --- |
| #692 | `bc1524edd359b64aae300c967b6c87a5c676421c` | Idempotent prod seed core |
| #695 | `7ee7016880fd7c4ec9e8bf8d6ec20d0c09ad2cb7` | OpenAPI / public event asset path tests |
| #699 tip | `85780f8868d1b81509cabe547b38368172e9c085` | Tenant branding `logoUrl`, `tenant_assets`, tenant-scoped proxy |

## Verdict rationale

Guards, idempotency, HMAC handling, public asset fail-closed design, and additive migration meet Epic #686 backend DoD and security bar on SHA `85780f88…`. **Known gap:** manifest shape from #697 (`tenantBrand.assets[]`) is not consumed by #699 seed/upload — coordinate manifest + upload plan before stacking brand PR for pilot E2E.
