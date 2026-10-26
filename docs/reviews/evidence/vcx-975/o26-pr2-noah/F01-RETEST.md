# F01 visual retest (post `af6374`)

**Issue:** `f01-drawer-open-390x844.png` @ `af6374bd` — DOM pass (5 menu items) but panel ~8px stripe (Drawer inline in `Layout` flex).

**Fix SHA:** `e61986a94fa213f120a8698ea96ba9cb5e375d29`

- `getContainer={() => document.body}`
- `size={240}`, `push={false}`, `rootClassName="portal-shell-nav-drawer"`

**Acceptance SHA:** `7b0ce31a6d6a58aa046c6a3f616fa9ab7f900864` (opaque open panel + transform).

**Noah @ `ebb2fa3f`:** intermediate geometry PASS only (`wrapper.opacity` 0.7) — `f01-visual-verify-ebb2fa3f.json`.

**Noah @ `7b0ce31a`:** **PASS** — `x:0`, opacity 1, 5 items, nav OK — `f01-visual-verify-7b0ce31a.json`, `f01-drawer-visual-390x844-7b0ce31a.png`.
