# F01 visual retest (post `af6374`)

**Issue:** `f01-drawer-open-390x844.png` @ `af6374bd` — DOM pass (5 menu items) but panel ~8px stripe (Drawer inline in `Layout` flex).

**Fix SHA:** `e61986a94fa213f120a8698ea96ba9cb5e375d29`

- `getContainer={() => document.body}`
- `size={240}`, `push={false}`, `rootClassName="portal-shell-nav-drawer"`

**Acceptance SHA:** `ebb2fa3fdbdd4dc7d6ec4e38466e2a0e42f39bbc` (force open panel transform).

**Noah @ `ebb2fa3f`:** PASS — `wrapper` 240×844 @ `x:0`, 5 menu items in viewport, nav click OK. Artifacts: `f01-visual-verify-ebb2fa3f.json`, `f01-drawer-visual-390x844-ebb2fa3f.png`.
