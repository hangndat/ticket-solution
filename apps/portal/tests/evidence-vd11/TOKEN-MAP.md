# VD11 — prototype token → portal implementation

Source of truth: `docs/design/vemoki-unified-v1/design-system/product/implementation/portal-antd-theme.ts`, `portal.html`, `portal-mobile.html`, `prototype.css`.

| Prototype / theme token | Value | Implementation |
| --- | --- | --- |
| `colorPrimary` | `#7C4DED` | `vemokiTheme.token.colorPrimary`, `VEMOKI_COLORS.primary`, `--vemoki-primary` |
| `colorInfo` | `#397DFF` | `vemokiTheme.token.colorInfo` |
| `colorError` | `#B3213A` | `vemokiTheme.token.colorError` (semantic red — errors only) |
| `colorText` / ink | `#172039` | `VEMOKI_COLORS.ink`, `--vemoki-ink` |
| `colorTextSecondary` | `#53607B` | `VEMOKI_COLORS.muted`, `--vemoki-muted` |
| `colorBgLayout` / paper | `#F6F8FC` | `VEMOKI_COLORS.paper`, `body` background |
| `colorBgContainer` | `#FFFFFF` | header, cards, context strip |
| `colorBorder` / line | `#DFE5F0` | `VEMOKI_COLORS.line`, `--vemoki-line` |
| Sider `portal-side` | `#0B1027` | `VEMOKI_COLORS.siderBg`, `Layout.siderBg`, ProLayout `navTheme="realDark"` |
| Sider selected | `#2B2354` | `VEMOKI_COLORS.siderItemSelected`, `Menu.darkItemSelectedBg` |
| Sider text | `#BAC5E4` / active `#FFFFFF` | ProLayout sider token overrides |
| Focus ring | `#3568EF` | `VEMOKI_COLORS.focus`, `--vemoki-focus` |
| `borderRadius` | `12` | global token; buttons `10` per theme file |
| `controlHeight` | `44` | token + `Button`/`Input`/`Select`; CSS min-height in `.portal-main-surface` |
| Card radius | `18` | `Card.borderRadiusLG` |
| Table header | `#F8FAFD` | `Table.headerBg` |
| Typography page title | ~28–30px semibold | `.portal-page-container` heading title rules |
| Typography label | 14px semibold | `Form.labelFontSize` + globals label |
| Typography helper | 13px muted | `.ant-form-item-explain` |
