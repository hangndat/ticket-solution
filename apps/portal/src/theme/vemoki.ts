import type { ThemeConfig } from 'antd';

/** Vemoki brand tokens → Ant Design ConfigProvider (ADR-20 / handoff §5). */
export const VEMOKI_COLORS = {
  ink: '#22241f',
  paper: '#f7f6f1',
  signal: '#9b3a18',
  focus: '#235fd0',
} as const;

export const vemokiTheme: ThemeConfig = {
  token: {
    colorPrimary: VEMOKI_COLORS.signal,
    colorInfo: VEMOKI_COLORS.focus,
    colorText: VEMOKI_COLORS.ink,
    colorBgLayout: VEMOKI_COLORS.paper,
    colorBgContainer: '#ffffff',
    controlOutline: VEMOKI_COLORS.focus,
    borderRadius: 6,
    fontFamily:
      "'Be Vietnam Pro', 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
    fontFamilyCode: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      siderBg: '#ffffff',
      bodyBg: VEMOKI_COLORS.paper,
    },
    Menu: {
      itemBorderRadius: 6,
    },
  },
};
