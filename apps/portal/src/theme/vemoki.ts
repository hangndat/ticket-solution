import type { ThemeConfig } from 'antd';

/**
 * Portal enterprise surface — solid violet product primary (#7C4DED).
 * Ant `colorPrimary` and default tenant brand both use `primary`; `signal` is legacy token red for CSS vars only.
 */
export const VEMOKI_COLORS = {
  ink: '#172039',
  paper: '#F6F8FC',
  signal: '#E11D48',
  focus: '#3568EF',
  line: '#DFE5F0',
  muted: '#53607B',
  /** Ant Design primary — enterprise violet (DEC-02), not marketing neon. */
  primary: '#7C4DED',
  siderBg: '#0B1027',
  siderItemSelected: '#2B2354',
  siderText: '#BAC5E4',
  siderTextActive: '#FFFFFF',
} as const;

/** Default tenant/event brand color placeholder and fallback (enterprise violet). */
export const DEFAULT_TENANT_PRIMARY_COLOR = VEMOKI_COLORS.primary;

/** Light-surface alert fills — WCAG AA body text on paper layout (VD10-R-01). */
export const PORTAL_ALERT_TOKENS = {
  colorInfoBg: '#E8F1FF',
  colorInfoBorder: '#B8D4FF',
  colorSuccessBg: '#E7F5EE',
  colorSuccessBorder: '#9FD4B8',
  colorWarningBg: '#FFF4E0',
  colorWarningBorder: '#E8C878',
  colorErrorBg: '#FCE8EC',
  colorErrorBorder: '#F0B8C4',
} as const;

export const vemokiTheme: ThemeConfig = {
  token: {
    colorPrimary: VEMOKI_COLORS.primary,
    colorInfo: '#397DFF',
    colorSuccess: '#127349',
    colorWarning: '#8A5800',
    colorError: '#B3213A',
    ...PORTAL_ALERT_TOKENS,
    colorText: VEMOKI_COLORS.ink,
    colorTextSecondary: VEMOKI_COLORS.muted,
    colorBgLayout: VEMOKI_COLORS.paper,
    colorBgContainer: '#ffffff',
    colorBorder: VEMOKI_COLORS.line,
    controlOutline: VEMOKI_COLORS.focus,
    borderRadius: 12,
    controlHeight: 44,
    fontSize: 16,
    fontSizeLG: 16,
    fontSizeHeading1: 30,
    fontSizeHeading2: 22,
    fontSizeHeading3: 18,
    fontSizeHeading4: 16,
    fontSizeHeading5: 14,
    lineHeight: 1.5,
    lineHeightHeading1: 1.2,
    fontFamily:
      "'Be Vietnam Pro', 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
    fontFamilyCode: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  components: {
    Button: {
      borderRadius: 10,
      controlHeight: 44,
      primaryShadow: 'none',
      defaultShadow: 'none',
    },
    Input: {
      controlHeight: 44,
      borderRadius: 12,
    },
    Select: {
      controlHeight: 44,
      borderRadius: 12,
    },
    Form: {
      labelFontSize: 14,
      labelColor: VEMOKI_COLORS.ink,
    },
    Alert: {
      colorInfoBg: PORTAL_ALERT_TOKENS.colorInfoBg,
      colorInfoBorder: PORTAL_ALERT_TOKENS.colorInfoBorder,
      colorSuccessBg: PORTAL_ALERT_TOKENS.colorSuccessBg,
      colorSuccessBorder: PORTAL_ALERT_TOKENS.colorSuccessBorder,
      colorWarningBg: PORTAL_ALERT_TOKENS.colorWarningBg,
      colorWarningBorder: PORTAL_ALERT_TOKENS.colorWarningBorder,
      colorErrorBg: PORTAL_ALERT_TOKENS.colorErrorBg,
      colorErrorBorder: PORTAL_ALERT_TOKENS.colorErrorBorder,
    },
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
