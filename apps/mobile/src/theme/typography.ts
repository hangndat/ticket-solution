import { fontFamilies } from './fonts.ts';

/**
 * Brand type roles — display Sora, body Be Vietnam Pro (Live Pulse v2).
 * Prefer Dynamic Type sizes via RN Text defaults when possible; these are role tokens.
 */
export const typography = {
  wordmark: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
  },
  display: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: 22,
    fontWeight: '600' as const,
  },
  body: {
    fontFamily: fontFamilies.body,
    fontSize: 17,
    fontWeight: '400' as const,
    lineHeight: 25,
  },
  callout: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  caption: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  /** 30pt marketing / list hero */
  hero: {
    fontFamily: fontFamilies.display,
    fontSize: 30,
    fontWeight: '700' as const,
  },
  /** 20pt section headers */
  sectionTitle: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 20,
    fontWeight: '600' as const,
  },
  sectionTitleBold: {
    fontFamily: fontFamilies.display,
    fontSize: 20,
    fontWeight: '700' as const,
  },
  /** 15pt secondary copy */
  subhead: {
    fontFamily: fontFamilies.body,
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  subheadSemibold: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
  /** 14pt helper / gate copy */
  footnote: {
    fontFamily: fontFamilies.body,
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  footnoteSemibold: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  bodySemibold: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 17,
    fontWeight: '600' as const,
  },
  /** 12pt meta */
  micro: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  /** 11pt pill / badge */
  badge: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
  },
};
