/**
 * Root stack route — outside NativeTabs.
 * Hidden tab trigger `account` is not navigable on iOS; do not push `/account`
 * from attendee chrome (same pattern as `/staff-account`).
 */
export const ATTENDEE_ACCOUNT_HREF = '/attendee-account' as const;

export const ATTENDEE_ACCOUNT_SEGMENT = 'attendee-account' as const;

/** Guest home: public Events catalog (O28). */
export const GUEST_HOME_HREF = '/(tabs)/(events)' as const;

/** Legacy deep-link path; redirects onto ATTENDEE_ACCOUNT_HREF. */
export const LEGACY_ATTENDEE_ACCOUNT_HREF = '/account' as const;
