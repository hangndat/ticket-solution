'use client';

export type PrivateTrustState = 'pending' | 'verified' | 'error';

type TrustOptions = {
  initialSubject: string | null;
  readSubject: () => Promise<string | null>;
  context?: () => number;
  mask: () => void;
  publish: (state: PrivateTrustState, context: number) => void;
  reload: () => void;
};

/** A server tree belongs to exactly one subject, including the guest subject. */
export class PrivateContentTrust {
  private generation = 0;
  private disposed = false;

  constructor(private readonly options: TrustOptions) {}

  mask() {
    if (this.disposed) return;
    this.generation += 1;
    this.options.mask();
    this.options.publish('pending', this.options.context?.() ?? 0);
  }

  async verify(): Promise<void> {
    this.mask();
    const generation = this.generation;
    const context = this.options.context?.() ?? 0;
    try {
      const subject = await this.options.readSubject();
      if (this.disposed || generation !== this.generation) return;
      if (subject !== this.options.initialSubject) {
        // A hard navigation discards every RSC/prefetch/router-cache entry from
        // the former identity before the replacement tree can be displayed.
        this.options.reload();
        return;
      }
      this.options.publish('verified', context);
    } catch {
      if (this.disposed || generation !== this.generation) return;
      this.options.publish('error', context);
    }
  }

  bind(
    page: EventTarget,
    documentEvents: EventTarget,
    isVisible: () => boolean,
  ): () => void {
    const onFocus = () => { void this.verify(); };
    const onBlur = () => { this.mask(); };
    const onPageShow = (event: Event) => {
      if ((event as PageTransitionEvent).persisted) void this.verify();
    };
    const onPageHide = () => { this.mask(); };
    const onVisibility = () => {
      if (isVisible()) void this.verify();
      else this.mask();
    };
    page.addEventListener('focus', onFocus);
    page.addEventListener('blur', onBlur);
    page.addEventListener('pageshow', onPageShow);
    page.addEventListener('pagehide', onPageHide);
    documentEvents.addEventListener('visibilitychange', onVisibility);
    return () => {
      page.removeEventListener('focus', onFocus);
      page.removeEventListener('blur', onBlur);
      page.removeEventListener('pageshow', onPageShow);
      page.removeEventListener('pagehide', onPageHide);
      documentEvents.removeEventListener('visibilitychange', onVisibility);
      this.disposed = true;
      this.generation += 1;
    };
  }
}
