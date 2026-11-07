/** Keep the native exit CTA above the WebView input accessory, even with a hardware keyboard. */
export function inviteFooterLift(keyboardHeight: number, inputFocused: boolean, accessoryClearance: number): number {
  return Math.max(keyboardHeight, inputFocused ? accessoryClearance : 0);
}
