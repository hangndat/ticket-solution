import { fontFamilies } from './fonts.ts';

/**
 * Brand type roles — display Syne, body Be Vietnam Pro (AC-V1).
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
};
