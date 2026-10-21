# Prod media — SVG sources (Epic #686 tenant logos)

Reproducible vector sources for `pnpm prod:media:build`. **Not** uploaded to MinIO (raster only per C-B).

| Path | Role |
| ---- | ---- |
| `tenant-logos.mjs` | Mark + lockup generators (imported by build) |
| `{tenant-slug}/mark.svg` | Square mark (regenerated on build) |
| `{tenant-slug}/lockup-light.svg` | Horizontal lockup for light backgrounds |
| `{tenant-slug}/lockup-dark.svg` | Horizontal lockup for dark backgrounds |

Tenants: `luc-bao-live`, `saigon-pulse`, `heritage-hoi-an`, `mekong-makers`.
