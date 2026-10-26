# F01 visual retest (post `af6374`)

**Issue:** `f01-drawer-open-390x844.png` @ `af6374bd` — DOM pass (5 menu items) but panel ~8px stripe (Drawer inline in `Layout` flex).

**Fix SHA:** `4cbe651b13c32b44d66ebd13138960e681694b4c`

- `getContainer={() => document.body}`
- `size={240}`, `push={false}`, `rootClassName="portal-shell-nav-drawer"`

**Noah:** rebuild/restart portal `:3019`, native `portal-nav-trigger` click, screenshot open drawer — expect full 240px menu visible, not mask-only.
