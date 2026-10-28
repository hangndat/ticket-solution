/** SF Symbols for the native header identity button (outline vs fill). */
export const ATTENDEE_PROFILE_ICON_GUEST = 'person.circle' as const;
export const ATTENDEE_PROFILE_ICON_SIGNED_IN = 'person.circle.fill' as const;

export function attendeeProfileHeaderIcon(
  signedIn: boolean,
): typeof ATTENDEE_PROFILE_ICON_GUEST | typeof ATTENDEE_PROFILE_ICON_SIGNED_IN {
  return signedIn
    ? ATTENDEE_PROFILE_ICON_SIGNED_IN
    : ATTENDEE_PROFILE_ICON_GUEST;
}
