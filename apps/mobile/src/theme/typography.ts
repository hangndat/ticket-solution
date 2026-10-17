/**
 * SF Pro weight hierarchy — display reserved for ticket/hero surfaces.
 * Prefer Dynamic Type sizes via RN Text defaults when possible; these are role tokens.
 */
export const typography = {
  wordmark: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
  },
  display: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 17,
    fontWeight: '400' as const,
    lineHeight: 25,
  },
  callout: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
};
