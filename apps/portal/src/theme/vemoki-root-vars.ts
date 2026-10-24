import { VEMOKI_COLORS } from './vemoki';

/** Portal global CSS custom properties — single mapping from VEMOKI_COLORS (brand SoT via vemoki.ts). */
export function buildVemokiRootCssBlock(): string {
  return `:root {
  --vemoki-ink: ${VEMOKI_COLORS.ink};
  --vemoki-paper: ${VEMOKI_COLORS.paper};
  --vemoki-signal: ${VEMOKI_COLORS.signal};
  --vemoki-focus: ${VEMOKI_COLORS.focus};
  --vemoki-line: ${VEMOKI_COLORS.line};
  --vemoki-muted: ${VEMOKI_COLORS.muted};
  --vemoki-sider: ${VEMOKI_COLORS.siderBg};
}`;
}
