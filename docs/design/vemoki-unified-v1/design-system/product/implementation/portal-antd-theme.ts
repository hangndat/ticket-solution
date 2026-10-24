/**
 * CONCEPT: map the product design into apps/portal/src/theme/vemoki.ts.
 * Do not replace existing ConfigProvider blindly; inspect current theme first.
 * Compiles against the currently installed Ant Design 6 API only after integration.
 */
import type { ThemeConfig } from 'antd';

export const vemokiProductPortalTheme: ThemeConfig = {
  token: {
    colorPrimary: '#7C4DED',
    colorInfo: '#397DFF',
    colorSuccess: '#127349',
    colorWarning: '#8A5800',
    colorError: '#B3213A',
    colorText: '#172039',
    colorTextSecondary: '#53607B',
    colorBgLayout: '#F6F8FC',
    colorBgContainer: '#FFFFFF',
    colorBorder: '#DFE5F0',
    borderRadius: 12,
    controlHeight: 44,
    fontFamily: 'Be Vietnam Pro, system-ui, sans-serif',
  },
  components: {
    Button: { borderRadius: 10, controlHeight: 44 },
    Card: { borderRadiusLG: 18 },
    Table: { headerBg: '#F8FAFD', rowHoverBg: '#F6F8FC' },
    Menu: { darkItemBg: '#0B1027', darkItemSelectedBg: '#2B2354' },
  },
};
