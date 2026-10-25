# VD-10 violet primary evidence

Product primary `#7C4DED` on consumer surfaces; marketing neon still uses `colors.signal` (`#E11D48`) via `@theme`.

## Capture

```bash
pnpm --filter @ticket/web start
node apps/web/tests/vd10-violet-evidence.mjs http://127.0.0.1:3000
```

## Intentional red (`#E11D48` / `signal`) after this change

| Location | Why still red |
| --- | --- |
| `brand/vemoki/tokens.json` `colors.signal` | Marketing neon Live Pulse accent (unchanged) |
| `packages/ui/src/generated/*` `--color-signal` | Same — marketing + product-preview-frame |
| `apps/web/src/marketing/**` | Neon marketing scope frozen |
| `packages/ui/src/marketing/**` | Marketing-only components |
| `apps/portal/**` | Out of web worker scope (portal has own primary) |
| `apps/mobile/**` | Zico sync — see worker_done mobile handoff |

## Checks

- `pnpm --filter @ticket/ui test` — pass
- `pnpm --filter @ticket/web test` — pass
- `pnpm --filter @ticket/web build` — pass
