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
  private flight: Promise<IntentOutcome> | null = null;

  constructor(
    private readonly actorId: string,
    readonly intent: IntentMutation<T>,
    private readonly currentActor: () => Promise<string | null>,
  ) {}

  get state() { return this.invalidated ? 'blocked' as const : this.intent.state; }
  get reason() { return this.invalidated ? 'identity' as const : this.intent.blockReason?.kind === 'blocked' ? this.intent.blockReason.reason : null; }

  run(
    payload: T,
    send: (body: T & { idempotencyKey: string }) => Promise<PortalFetchResult>,
    confirmed: (response: PortalFetchResult) => boolean,
  ): Promise<IntentOutcome> {
    if (this.flight) return this.flight;
    if (this.invalidated) return Promise.resolve({ kind: 'blocked', reason: 'identity' });
    this.flight = (async (): Promise<IntentOutcome> => {
      const before = await this.readActor();
      if (before !== this.actorId || this.invalidated) {
        this.invalidated = true;
        return { kind: 'blocked', reason: 'identity' };
      }
      // A confirmed response must retain its marker until the actor check succeeds.
      const outcome = await this.intent.run(payload, send, async (response) => {
        if (!confirmed(response)) return false;
        const actor = await this.readActor();
        if (actor !== this.actorId || this.invalidated) {
          this.invalidated = true;
          return false;
        }
        return true;
      });
      if (outcome.kind === 'confirmed') return outcome;
      const after = await this.readActor();
      if (after !== this.actorId || this.invalidated) {
        this.invalidated = true;
        return { kind: 'blocked', reason: 'identity' };
      }
      return outcome;
    })().finally(() => { this.flight = null; });
    return this.flight;
  }

  private async readActor(): Promise<string | null> {
    try { return await this.currentActor(); } catch { return null; }
  }
}
