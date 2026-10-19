export function shouldOfferWalletPushPrompt(input: {
  ticketCount: number;
  dismissed: boolean;
  providerIsApns: boolean;
  identityVerified: boolean;
  iosPermissionAuthorized: boolean;
}): boolean {
  if (!input.providerIsApns || !input.identityVerified) return false;
  if (input.dismissed || input.iosPermissionAuthorized) return false;
  return input.ticketCount >= 1;
}
