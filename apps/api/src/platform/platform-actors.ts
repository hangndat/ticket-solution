import { IDENTITY_ERROR_CODES, PLATFORM_ERROR_CODES } from '@ticket/contracts';
import { IdentityError, PlatformError } from '@ticket/backend';
import type { PlatformDeps } from './platform-deps';

export class PlatformActors {
  constructor(private readonly deps: PlatformDeps) {}

  async platformActor(authorization: string | undefined) {
    if (this.deps.bootError) throw this.deps.bootError;
    if (!this.deps.platformVerifier || !this.deps.users || !this.deps.db) {
      throw new PlatformError(
        PLATFORM_ERROR_CODES.PLATFORM_MISCONFIGURED,
        'Platform not configured',
      );
    }
    const verified =
      await this.deps.platformVerifier.verifyBearerToken(authorization);
    return this.deps.users.upsertFromVerifiedIdentity(verified);
  }

  async selfActor(authorization: string | undefined) {
    // /me/* uses standard attendee OIDC (no MFA ACR). Do not widen platform verifier.
    if (this.deps.bootError) throw this.deps.bootError;
    if (!this.deps.users || !this.deps.db) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Identity not configured',
      );
    }
    if (!this.deps.identityVerifier) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Identity verifier not configured',
      );
    }
    const verified =
      await this.deps.identityVerifier.verifyBearerToken(authorization);
    return this.deps.users.upsertFromVerifiedIdentity({
      issuer: verified.issuer,
      subject: verified.subject,
      email: verified.email,
      emailVerified: verified.emailVerified,
    });
  }
}
