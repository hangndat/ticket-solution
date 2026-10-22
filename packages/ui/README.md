# @ticket/ui

Live Pulse v2 design primitives for consumer web (`apps/web`). Token SoT: `brand/vemoki/tokens.json` → `src/generated/vemoki-theme.css`.

## Imports

| Entry | Use |
| --- | --- |
| `@ticket/ui` | `cn`, tokens, **server-safe** primitives |
| `@ticket/ui/cn` | `cn()` only |
| `@ticket/ui/client` | `UiMotionProvider` — **client island only**; never mount from root layout until a slice needs motion |
| `@ticket/ui/vemoki-theme.css` | Tailwind `@theme` colors in `globals.css` |

## Variant / size / state

### Button

| Variant | Role |
| --- | --- |
| `primary` | Signal CTA (`--color-signal`) |
| `secondary` | Outlined on paper |
| `ghost` | Text-only |
| `destructive` | Irreversible / danger (`--color-destructive`) |

| Size | Min height |
| --- | --- |
| `sm` | 44px (`min-h-11`) |
| `md` | 44px (default) |

| State | Behavior |
| --- | --- |
| `disabled` | Native `disabled`, no pointer events |
| `loading` | `aria-busy`, spinner + `loadingLabel` (default VI) |

### Input

| State | Behavior |
| --- | --- |
| default | Border `--color-line` |
| `error` / `error` prop | `aria-invalid`, destructive border |
| `disabled` | Native `disabled` |

Pair with `Label` + `FieldError` (`role="alert"`).

### Card

| Variant | |
| --- | --- |
| `elevated` | Subtle shadow (default) |
| `outline` | Border only |

### Alert

| Variant | `role` |
| --- | --- |
| `default` | `status` |
| `destructive` | `alert` |

### SurfaceState

Kinds: `empty` | `loading` | `error` | `unknown`. Class names match `apps/web` legacy `.surface-state` for drop-in migration.

## Tailwind prefix

Consumer `globals.css` loads utilities as `prefix(ui)` — primitive classes use the `ui:` prefix (e.g. `ui:min-h-11`) so legacy `.container` and other unprefixed classes stay unchanged.

## Focus & a11y

- Focus ring: **3px** `--color-focus`, offset on `--color-paper` (`focusRingClass` / primitives).
- Touch targets: **44px** min height on `Button` / `Input`.
- Motion: primitives use CSS only (`animate-pulse`, `animate-spin`) with `motion-reduce:animate-none`. Framer Motion only via `@ticket/ui/client` on explicit islands.

## Dev preview

`apps/web/app/dev/design-system` — 404 in production (`NODE_ENV=production`).
