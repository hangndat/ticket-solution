/**
 * Map DB notification.state to honest providerStatus.
 * SMTP/APNs accept ≠ end-user delivered. SENT means provider accepted.
 */
export type ProviderStatus = 'PENDING' | 'ACCEPTED' | 'FAILED' | 'DEAD';

export function providerStatusFromDbState(state: string): ProviderStatus {
  switch (state) {
    case 'SENT':
    case 'ACCEPTED':
      // Provider accepted (SMTP/APNs 200). Never map to a fictional DELIVERED.
      return 'ACCEPTED';
    case 'FAILED':
      return 'FAILED';
    case 'DEAD':
      return 'DEAD';
    case 'PENDING':
    default:
      return 'PENDING';
  }
}

export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.slice(0, 1);
  return `${head}***@${domain}`;
}
