import type { ThemeConfig } from 'antd';

/**
 * Live Pulse product tokens (brand/vemoki/tokens.json) → Ant Design ConfigProvider.
 * VD-07: replace legacy terracotta palette; align with portal-antd-theme structure.
 */
export const VEMOKI_COLORS = {
  ink: '#0B1220',
  paper: '#F4F6F8',
  signal: '#E11D48',
  focus: '#2563EB',
  line: '#D7DFE9',
  muted: '#5B687B',
  siderBg: '#0B1027',
  siderItemSelected: '#2B2354',
  siderText: '#BAC5E4',
  siderTextActive: '#FFFFFF',
} as const;

export const vemokiTheme: ThemeConfig = {
  token: {
    colorPrimary: VEMOKI_COLORS.signal,
    colorInfo: VEMOKI_COLORS.focus,
    colorText: VEMOKI_COLORS.ink,
    colorTextSecondary: VEMOKI_COLORS.muted,
    colorBgLayout: VEMOKI_COLORS.paper,
    colorBgContainer: '#ffffff',
    colorBorder: VEMOKI_COLORS.line,
    controlOutline: VEMOKI_COLORS.focus,
    borderRadius: 12,
    controlHeight: 44,
    fontFamily:
      "'Be Vietnam Pro', 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
    fontFamilyCode: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  components: {
    Button: { borderRadius: 10, controlHeight: 44 },
    Card: { borderRadiusLG: 18 },
    Table: { headerBg: '#F8FAFD', rowHoverBg: VEMOKI_COLORS.paper },
    Layout: {
      headerBg: '#ffffff',
      siderBg: VEMOKI_COLORS.siderBg,
      bodyBg: VEMOKI_COLORS.paper,
    },
    Menu: {
      darkItemBg: VEMOKI_COLORS.siderBg,
      darkItemSelectedBg: VEMOKI_COLORS.siderItemSelected,
      darkItemColor: VEMOKI_COLORS.siderText,
      darkItemSelectedColor: VEMOKI_COLORS.siderTextActive,
      itemBorderRadius: 10,
    },
  },
};
