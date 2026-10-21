# Epic #686 — Media DoD (prod seed raster + tenant logos)

| Trường | Giá trị |
| --- | --- |
| Epic | [#686](https://github.com/hangndat/ticket-solution/issues/686) |
| PR reviewed | [#697](https://github.com/hangndat/ticket-solution/pull/697) (stack includes #691 `6b04ecb`) |
| Commit SHA | `8d03ce05d0c9f4b28d814251508057da1d1aa5d4` |
| Reviewer | Orca worker `task_6db7a6645526` (reviewer-dod; ≠ implementer) |
| Verdict | **PASS with known gap** |
| Upload prod / MinIO | **Không** (repo-only review) |

## CI (REST on SHA)

```text
repo=hangndat/ticket-solution pr=697
head.sha=8d03ce05d0c9f4b28d814251508057da1d1aa5d4
state=open mergeable=true
ci, turbo-persist, backend, portal, web, mobile, changes → success
```

Command: `./scripts/gh-dod-evidence.sh 697`

## Automated verify

On SHA `8d03ce05` (after `pnpm install --frozen-lockfile`):

```text
pnpm prod:media:verify → prod-media-verify PASS (48 files)
```

Script: `scripts/prod-media-verify.mjs` — mirrors `ASSET_LIMITS` (`packages/contracts/src/config.ts:22-28`): ≤5 MiB, ≤4096 px edge, ≤16M pixels, MIME png/jpeg/webp only.

## Build reproducibility

Two consecutive `node scripts/prod-media-build.mjs` runs:

- Aggregate MD5 of all `brand/prod/**/*.{png,webp}` **identical** between runs.
- `brand/prod/manifest.json` **only** `generatedAt` timestamp changes (non-byte-stable manifest metadata; raster outputs stable).

## UUID / dataset alignment

`brand/prod/manifest.json` at SHA:

- Tenants `686f0001-0001-4000-8000-000000000001` … `000004` ↔ `docs/demo/PROD-SEED-DATASET.md:36-41`
- Events `686f0001-0002-4000-8000-000000000001` … `000006` ↔ dataset §Events
- Event assets `686f0001-0008-4000-8000-000{EE}0101/0102` (EE=01…06) ↔ dataset §Media inventory:193-200
- Tenant logo slots `686f0001-0008-4000-8000-00000{nn}01` (nn=1…4) ↔ manifest `tenantBrand.logo.assetId`

## SVG / upload policy

- Client rejects `.svg` (and HTML/JS): `apps/web/src/admin/config-assets.ts:36-49`
- Server magic-byte + rejects SVG/HTML: `packages/backend/src/config-assets.ts:33-52`
- Prod raster tree `brand/prod/**` contains **no** `.svg`; sources live under `scripts/prod-media-src/` (build-only).

## Visual QA (manual — contact sheets + masters)

Evidence images on PR branch: `docs/reviews/EPIC686-MEDIA-contact-sheet.png`, `docs/reviews/EPIC686-TENANT-LOGO-contact-sheet.png`.

| Check | Result |
| --- | --- |
| 4 tenant identities visually distinct | Pass — hex/pulse/lantern/delta motifs (tenant sheet) |
| Mark readable ~32px on paper `#F4F6F8` and ink `#0B1220` | Pass — contact sheet rows at 32px/64px |
| Lockups light + dark variants | Pass — `logo.png` / `logo-dark.png` (+ WebP) per org in manifest |
| 6 event banners 1200×630, text/mark in left safe zone | Pass — spot-check `pulse-afterhours`, `festival-an-song` banners; no title clipped at native 1200×630 |
| Logo lockups 760×200, transparent PNG | Pass — verify script + contact sheet |
| `object-fit: cover` / `resizeMode: cover` vs master aspect | Pass — masters are 16∶9; web list/hero and iOS use cover (`apps/web/app/globals.css:554-564`, `apps/mobile/src/components/event-media.tsx:79`) |

## Surface cross-check (`docs/design/prod-seed-media/README.md` §2)

| PD surface | Display code | Prod manifest |
| --- | --- | --- |
| Web banner intrinsic 1200×630 | `apps/web/src/ui/event-media.tsx:43-44` | `*/banner.webp` 1200×630 |
| Web list banner cover max-h 220 | `globals.css:550-556` | Same banner master |
| Web list logo max-h 40 | `globals.css:574-577` | Event `logo.png` 760×200 |
| Web hero cover | `globals.css:558-564` | Banner master |
| Web site mark ~30–34px / 64 box | `docs/design/.../README.md:69` | `mark-512.png` + lockups (tenant suite) |
| iOS list banner h 140 cover | `event-media.tsx:65,79` | Banner master |
| iOS detail banner h 220 cover | `event-detail.tsx` (uses `EventBanner`) | Banner master |
| iOS detail logo h 36 contain | `event-media.tsx:96+` (default height 36) | Logo 760×200 |
| iOS ticket logo h 32 | `my-tickets.tsx` / `ticket-detail.tsx` per PD §2.2 | Logo master |
| Tenant chrome `TenantLogo` h 36 | PD §2.2 | `tenantBrand.logo` → `logo.png` |

### Surfaces still without dedicated prod raster or wiring (known gap)

1. **Published URL projection** — `PublishedBrand` / public `logoUrl` not resolved from `logoAssetId` (`docs/design/prod-seed-media/README.md:75`, G1–G2). Consumers still demo-pack or remote URL only.
2. **Web event hero `EventLogo`** — CSS `.event-logo-hero` exists; event detail page does not render logo (`README.md:67`, G3).
3. **Per-event OG `og:image`** — not implemented (`README.md:111-112`, G4).
4. **Admin upload preview** — `config-brand-panel` text-only (`README.md:70`).
5. **MinIO + DB seed** — `prod-seed-media.sh` / `logoAssetId` on prod DB not in #697 scope (`docs/reviews/EPIC686-MEDIA.md:52-53`, dataset AC §C).
6. **Email** — platform `brand/vemoki/email-header.png` only; no per-org email header raster in `brand/prod` (PD §2.5; acceptable for MVP).
7. **Tenant tile roles** (`tile-341/682/1024`) — present in manifest for future avatar/@3x; **no** dedicated consumer path in `apps/web` / `apps/mobile` yet (runtime scales lockup/mark).

## Findings (actionable)

| ID | Severity | Location | Note |
| --- | --- | --- | --- |
| F1 | gap | `docs/design/prod-seed-media/README.md:217-218` | BE must populate `logoUrl` from READY assets before chrome shows prod org marks |
| F2 | gap | `docs/design/prod-seed-media/README.md:219` | Optional web polish: mount `EventLogo` on event hero |
| F3 | info | `scripts/prod-media-verify.mjs:22-28` | Limits duplicated from contracts (intentional for standalone verify) |
| F4 | info | `brand/prod/manifest.json` | `generatedAt` changes each build; consider stripping for byte-stable manifest if CI diffs manifest |

## Scope reviewed at SHA

- `brand/prod/**`, `brand/prod/manifest.json`
- `scripts/prod-media-build.mjs`, `scripts/prod-media-verify.mjs`, `scripts/prod-media-src/**`
- `docs/reviews/EPIC686-MEDIA.md`, `docs/reviews/EPIC686-TENANT-LOGO.md`
- Contract limits `packages/contracts/src/config.ts`
- Display surfaces `apps/web/src/ui/event-media.tsx`, `apps/web/app/globals.css`, `apps/mobile/src/components/event-media.tsx`

## Recommendation

Merge **#697** after coordinator accepts **PASS with known gap**: repo media pack + verify + tenant redesign satisfy Epic media **production** AC; integration (MinIO seed, published URLs, Playwright/iOS UAT on prod URLs) remains follow-up per dataset §C and PD §6.
