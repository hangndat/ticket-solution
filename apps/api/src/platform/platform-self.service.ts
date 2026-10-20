import type { MeEventsResponse } from '@ticket/contracts';
import {
  acceptMembershipInvite,
  createAccountDeletionRequest,
  getCurrentAccountDeletionRequest,
  listMyEvents,
  listMyTenants,
} from '@ticket/backend';
import type { PlatformActors } from './platform-actors';
import type { PlatformDeps } from './platform-deps';
import { platformRouteFail } from './platform-errors';

export class PlatformSelfService {
  constructor(
    private readonly deps: PlatformDeps,
    private readonly actors: PlatformActors,
  ) {}

  myTenants(authorization: string | undefined) {
    return this.actors
      .selfActor(authorization)
      .then(async (u) => ({ items: await listMyTenants(this.deps.db!, u.userId) }))
      .catch(platformRouteFail);
  }

  myEvents(authorization: string | undefined): Promise<MeEventsResponse> {
    return this.actors
      .selfActor(authorization)
      .then((u) => listMyEvents(this.deps.db!, u.userId))
      .catch(platformRouteFail);
  }

  acceptInvite(authorization: string | undefined, body: { token: string }) {
    return this.actors
      .selfActor(authorization)
      .then((u) =>
        acceptMembershipInvite(this.deps.db!, {
          userId: u.userId,
          email: u.email,
          emailVerified: u.emailVerified,
          token: body.token,
        }),
      )
      .catch(platformRouteFail);
  }

  requestDeletion(authorization: string | undefined, body: { confirmation: true }) {
    return this.actors
      .selfActor(authorization)
      .then((u) =>
        createAccountDeletionRequest(this.deps.db!, {
          userId: u.userId,
          confirmation: body.confirmation,
        }),
      )
      .catch(platformRouteFail);
  }

  currentDeletion(authorization: string | undefined) {
    return this.actors
      .selfActor(authorization)
      .then((u) => getCurrentAccountDeletionRequest(this.deps.db!, u.userId))
      .catch(platformRouteFail);
  }
}
