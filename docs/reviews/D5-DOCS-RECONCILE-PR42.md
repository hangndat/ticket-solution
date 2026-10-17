# Reconcile — PR #42 root assets → PR #53 (không merge/close #42)

Ngày: 2026-10-17 · Branch: `hangndat/d5-issue25-obs-load`  
Nguồn PR #42 head: `ec98778` (`hangndat/d1-vps-runtime`) · **Không** sửa branch #42 · **Không** merge/close #42/#33.

## Đã port (root ownership)

| Path | Ghi chú |
| --- | --- |
| `brand/vemoki/**` | Pack thương hiệu |
| `.dockerignore` | Build context |
| `infra/deploy/**` | Compose/Dockerfile/README/init-db |
| `.cursor/skills/deploy-prod/SKILL.md` | F6: bỏ SSH IP; dùng alias `conanphong` / `VEMoki_SSH_HOST` |
| `infra/keycloak/realm-ticket.json` | O09 names + dual `vemoki`/`ticketsolution` callback+logout (F5) |
| `docs/DECISION-LOG.md` | Thêm O09 + ADR-16; không regress O01–O08 |

## Sửa theo review #42 (root)

- **F2:** ROADMAP giữ progress D4/D5 từ main; Load/Obs/Business restore vẫn `[ ]` tới acceptance (Issue #25).
- **F4:** deploy README + skill bắt buộc overwrite `X-Forwarded-Host $host`; app `PUBLIC_WEB_ORIGIN` (web worker sở hữu code).
- **F5:** realm giữ dual scheme + `vemoki://oauth/logout`.
- **F6:** không commit endpoint SSH.

## Không port (out of scope root)

- `apps/web/**`, `apps/mobile/**` — web/iOS workers
- `packages/backend/**`, `pnpm-lock.yaml` — BE/coordinator lockfile
- PDF `FUN-FEST-…` — không có trên tree PR42 remote lúc checkout

## Provenance

```text
git checkout origin/hangndat/d1-vps-runtime -- brand/vemoki .dockerignore infra/deploy \
  .cursor/skills/deploy-prod/SKILL.md infra/keycloak/realm-ticket.json
```

Sau khi bốn PR brand/deploy/web/iOS ổn định, coordinator có thể close #42 **superseded** — không drop work đã port.
