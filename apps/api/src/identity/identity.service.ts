import { Injectable } from '@nestjs/common';
import { IDENTITY_ERROR_CODES, type MeResponse } from '@ticket/contracts';
import {
  IdentityError,
  type IdentityUserRepository,
  type OidcVerifier,
} from '@ticket/backend';

@Injectable()
export class IdentityService {
  constructor(
    private readonly verifier: OidcVerifier | null,
    private readonly users: IdentityUserRepository | null,
    private readonly bootError: IdentityError | null,
  ) {}

  async me(authorization: string | undefined): Promise<MeResponse> {
    if (this.bootError) throw this.bootError;
    if (!this.verifier || !this.users) {
      throw new IdentityError(
        IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
        'Identity services are not configured',
      );
    }
    const verified = await this.verifier.verifyBearerToken(authorization);
    const user = await this.users.upsertFromVerifiedIdentity(verified);
    return {
      userId: user.userId,
      issuer: user.issuer,
      subject: user.subject,
      email: user.email,
      emailVerified: user.emailVerified,
    };
  }
}
