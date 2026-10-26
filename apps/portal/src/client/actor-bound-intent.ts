import { IntentMutation, type IntentOutcome } from './intent-mutation';
import type { PortalFetchResult } from './portal-fetch';

export function actorFromSubject(result: PortalFetchResult): string | null {
  const actor = result.status === 200 && result.json && typeof result.json === 'object'
    ? (result.json as { userId?: unknown }).userId : null;
  return typeof actor === 'string' && actor.trim() ? actor : null;
}

/** A mounted intent cannot send or report an outcome after its session changes. */
export class ActorBoundIntent<T extends object> {
  private invalidated = false;

  constructor(
    private readonly actorId: string,
    readonly intent: IntentMutation<T>,
    private readonly currentActor: () => Promise<string | null>,
  ) {}

  get state() { return this.invalidated ? 'blocked' as const : this.intent.state; }
  get reason() { return this.invalidated ? 'identity' as const : this.intent.blockReason?.kind === 'blocked' ? this.intent.blockReason.reason : null; }

  async run(
    payload: T,
    send: (body: T & { idempotencyKey: string }) => Promise<PortalFetchResult>,
    confirmed: (response: PortalFetchResult) => boolean,
  ): Promise<IntentOutcome> {
    if (this.invalidated) return { kind: 'blocked', reason: 'identity' };
    const before = await this.currentActor();
    if (before !== this.actorId || this.invalidated) {
      this.invalidated = true;
      return { kind: 'blocked', reason: 'identity' };
    }
    const outcome = await this.intent.run(payload, send, confirmed);
    const after = await this.currentActor();
    if (after !== this.actorId || this.invalidated) {
      this.invalidated = true;
      return { kind: 'blocked', reason: 'identity' };
    }
    return outcome;
  }
}
