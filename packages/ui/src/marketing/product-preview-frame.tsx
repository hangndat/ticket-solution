'use client';

import { useId, useState } from 'react';
import { cn } from '../cn.js';

export type ProductPreviewLabels = {
  tabsLabel: string;
  tabWallet: string;
  tabGate: string;
  urlWallet: string;
  urlGate: string;
  caption: string;
  demoPill: string;
  navWallet: string;
  navGate: string;
  walletTitle: string;
  walletSub: string;
  ticketUnused: string;
  eventRiver: string;
  gateHint: string;
  gateOk: string;
  gateDup: string;
  gateEvent: string;
  phoneMeta: string;
};

type PreviewTab = 'wallet' | 'gate';

export type ProductPreviewFrameProps = {
  labels: ProductPreviewLabels;
  className?: string;
};

export function ProductPreviewFrame({ labels, className }: ProductPreviewFrameProps) {
  const [tab, setTab] = useState<PreviewTab>('wallet');
  const panelId = useId();
  const url = tab === 'wallet' ? labels.urlWallet : labels.urlGate;

  return (
    <div
      className={cn('relative max-w-full overflow-hidden', className)}
      data-testid="product-preview-frame"
    >
      <div
        className="pointer-events-none absolute -inset-x-[5%] -inset-y-[8%] bg-[radial-gradient(circle_at_50%_40%,color-mix(in_srgb,var(--color-focus)_25%,transparent),transparent_65%)] blur-[40px]"
        aria-hidden="true"
      />
      <div className="relative pt-2 pb-8">
        <div
          className={cn(
            'origin-center-left transition-transform duration-200 max-md:transform-none',
            'perspective-[1200px] transform-[perspective(1200px)_rotateY(-6deg)_rotateX(3deg)]',
            'group-hover/preview:transform-[perspective(1200px)_rotateY(-3deg)_rotateX(2deg)]',
          )}
        >
          <div
            className="group/preview relative rounded-xl border border-paper/15 bg-gradient-to-br from-[color-mix(in_srgb,var(--color-ink)_80%,black)] to-[color-mix(in_srgb,var(--color-ink)_90%,black)] p-2.5 shadow-frame"
          >
            <div
              className="flex items-center gap-1.5 border-b border-paper/10 px-3 py-2"
              aria-hidden="true"
            >
              <i className="block size-2 rounded-full bg-paper/20" />
              <i className="block size-2 rounded-full bg-paper/20" />
              <i className="block size-2 rounded-full bg-paper/20" />
              <span className="flex-1 text-center text-[0.65rem] tracking-wide text-paper/45">
                {url}
              </span>
            </div>
            <div
              className="flex gap-1 px-2.5 pt-2"
              role="tablist"
              aria-label={labels.tabsLabel}
            >
              <button
                type="button"
                role="tab"
                id={`${panelId}-wallet`}
                aria-selected={tab === 'wallet'}
                aria-controls={`${panelId}-panel`}
                onClick={() => setTab('wallet')}
                className={cn(
                  'min-h-9 cursor-pointer rounded-t-md border-0 bg-transparent px-2.5 py-1.5 text-[0.7rem] font-semibold text-paper/50',
                  tab === 'wallet' && 'bg-paper/10 text-paper',
                )}
              >
                {labels.tabWallet}
              </button>
              <button
                type="button"
                role="tab"
                id={`${panelId}-gate`}
                aria-selected={tab === 'gate'}
                aria-controls={`${panelId}-panel`}
                onClick={() => setTab('gate')}
                className={cn(
                  'min-h-9 cursor-pointer rounded-t-md border-0 bg-transparent px-2.5 py-1.5 text-[0.7rem] font-semibold text-paper/50',
                  tab === 'gate' && 'bg-paper/10 text-paper',
                )}
              >
                {labels.tabGate}
              </button>
            </div>
            <div
              className="min-h-[280px] overflow-hidden rounded-b-[calc(var(--radius-xl)-8px)] bg-gradient-to-b from-[color-mix(in_srgb,var(--color-paper)_98%,white)] to-[color-mix(in_srgb,var(--color-paper)_92%,var(--color-line))]"
              role="tabpanel"
              id={`${panelId}-panel`}
              aria-labelledby={tab === 'wallet' ? `${panelId}-wallet` : `${panelId}-gate`}
              aria-live="polite"
            >
              {tab === 'wallet' ? (
                <div className="min-h-[280px] p-3.5 text-ink">
                  <div className="mb-3 flex items-center justify-between gap-2 border-b border-line pb-2.5 text-[0.72rem]">
                    <span className="font-display font-bold tracking-tight">vemoki</span>
                    <span className="font-semibold text-muted">{labels.navWallet}</span>
                  </div>
                  <div className="mb-3.5 flex items-start justify-between gap-3">
                    <div>
                      <strong className="block font-display text-[1.05rem]">{labels.walletTitle}</strong>
                      <span className="text-[0.72rem] text-muted">{labels.walletSub}</span>
                    </div>
                    <span className="inline-flex shrink-0 items-center rounded-full border border-signal/25 bg-signal/10 px-2 py-0.5 text-[0.62rem] font-bold tracking-wide text-signal uppercase">
                      {labels.demoPill}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <article className="flex flex-col overflow-hidden rounded-md border border-line bg-white shadow-sm">
                      <div className="h-[52px] bg-gradient-to-br from-indigo-900 to-rose-700" />
                      <div className="flex flex-col gap-0.5 p-2 text-[0.68rem] text-muted">
                        <span className="text-[0.62rem] font-semibold text-admit">{labels.ticketUnused}</span>
                        <strong className="text-[0.78rem] text-ink">MFest</strong>
                        <span>24/10 · 18:00 · HCM</span>
                        <code className="mt-0.5 self-start rounded bg-[color-mix(in_srgb,var(--color-paper)_92%,var(--color-line))] px-1.5 py-0.5 font-mono text-[0.62rem] text-ink">
                          DEMO-8K2P
                        </code>
                      </div>
                    </article>
                    <article className="flex flex-col overflow-hidden rounded-md border border-line bg-white shadow-sm">
                      <div className="h-[52px] bg-gradient-to-br from-teal-700 to-green-500" />
                      <div className="flex flex-col gap-0.5 p-2 text-[0.68rem] text-muted">
                        <span className="text-[0.62rem] font-semibold text-admit">{labels.ticketUnused}</span>
                        <strong className="text-[0.78rem] text-ink">{labels.eventRiver}</strong>
                        <span>31/10 · 19:00 · HCM</span>
                        <code className="mt-0.5 self-start rounded bg-[color-mix(in_srgb,var(--color-paper)_92%,var(--color-line))] px-1.5 py-0.5 font-mono text-[0.62rem] text-ink">
                          DEMO-3R7N
                        </code>
                      </div>
                    </article>
                  </div>
                </div>
              ) : (
                <div className="min-h-[280px] p-3.5 text-ink">
                  <div className="mb-3 flex items-center justify-between gap-2 border-b border-line pb-2.5 text-[0.72rem]">
                    <span className="font-display font-bold tracking-tight">vemoki</span>
                    <span className="font-semibold text-muted">{labels.navGate}</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid place-items-center gap-2 p-2">
                      <div className="relative size-24 rounded-md border-2 border-dashed border-line bg-paper" aria-hidden="true">
                        <span className="absolute top-0 left-0 size-3 border-t-2 border-l-2 border-ink" />
                        <span className="absolute top-0 right-0 size-3 border-t-2 border-r-2 border-ink" />
                        <span className="absolute bottom-0 left-0 size-3 border-b-2 border-l-2 border-ink" />
                        <span className="absolute right-0 bottom-0 size-3 border-r-2 border-b-2 border-ink" />
                        <div className="mx-auto mt-6 size-14 rounded bg-[color-mix(in_srgb,var(--color-ink)_8%,var(--color-paper))]" />
                      </div>
                      <p className="text-center text-[0.72rem] text-muted">{labels.gateHint}</p>
                    </div>
                    <div className="text-[0.72rem]">
                      <span className="mb-2 inline-flex items-center rounded-full border border-signal/25 bg-signal/10 px-2 py-0.5 text-[0.62rem] font-bold tracking-wide text-signal uppercase">
                        {labels.demoPill}
                      </span>
                      <p className="font-medium text-ink">{labels.gateOk}</p>
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-muted">
                        <li>{labels.gateDup}</li>
                        <li>{labels.gateEvent}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 hidden md:block" aria-hidden="true">
            <div className="mx-auto w-[42%] rounded-[1.75rem] border-4 border-ink/80 bg-ink p-1.5 shadow-soft">
              <div className="h-1.5 w-1/3 mx-auto rounded-full bg-ink/40" />
              <div className="mt-2 grid place-items-center gap-1 rounded-[1.25rem] bg-paper p-3 text-center text-ink">
                <span className="rounded-full border border-signal/25 bg-signal/10 px-1.5 py-0.5 text-[0.55rem] font-bold tracking-wide text-signal uppercase">
                  {labels.demoPill}
                </span>
                <strong className="font-display">MFest</strong>
                <span className="text-[0.65rem] text-muted">{labels.phoneMeta}</span>
                <div className="my-1 size-16 rounded bg-[color-mix(in_srgb,var(--color-ink)_8%,var(--color-paper))]" />
                <span className="font-mono text-[0.7rem]">DEMO-8K2P</span>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-[0.72rem] text-paper/55">{labels.caption}</p>
      </div>
    </div>
  );
}
