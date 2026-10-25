import type { ThemeConfig } from 'antd';

/**
 * Portal enterprise surface + Live Pulse tenant signal.
 * Ant `colorPrimary` follows portal-antd-theme (violet); tenant brand default uses `signal` (DEC-04).
 */
export const VEMOKI_COLORS = {
  ink: '#172039',
  paper: '#F6F8FC',
  signal: '#E11D48',
  focus: '#2563EB',
  line: '#DFE5F0',
  muted: '#53607B',
  /** Ant Design primary — enterprise violet (DEC-02), not marketing neon. */
  primary: '#7C4DED',
  siderBg: '#0B1027',
  siderItemSelected: '#2B2354',
  siderText: '#BAC5E4',
  siderTextActive: '#FFFFFF',
} as const;

/** Default tenant/event brand color placeholder and fallback (Live Pulse signal). */
export const DEFAULT_TENANT_PRIMARY_COLOR = VEMOKI_COLORS.signal;

export const vemokiTheme: ThemeConfig = {
  token: {
    colorPrimary: VEMOKI_COLORS.primary,
    colorInfo: '#397DFF',
    colorSuccess: '#127349',
    colorWarning: '#8A5800',
    colorError: '#B3213A',
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
    Button: { borderRadius: 12, controlHeight: 44 },
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
