'use client';

import { useId, useState } from 'react';

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
    <div className={className ?? 'mkt-preview-wrap'} data-testid="product-preview-frame">
      <div className="mkt-preview-glow" aria-hidden="true" />
      <div className="mkt-preview-stage">
        <div className="mkt-preview-tilt">
          <div className="mkt-preview-frame">
            <div className="mkt-preview-chrome" aria-hidden="true">
              <i />
              <i />
              <i />
              <span>{url}</span>
            </div>
            <div
              className="mkt-preview-tabs"
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
              >
                {labels.tabGate}
              </button>
            </div>
            <div
              className="mkt-preview-viewport"
              role="tabpanel"
              id={`${panelId}-panel`}
              aria-labelledby={tab === 'wallet' ? `${panelId}-wallet` : `${panelId}-gate`}
              aria-live="polite"
            >
              {tab === 'wallet' ? (
                <div className="mkt-ui-compose mkt-ui-compose--wallet">
                  <div className="mkt-ui-compose__bar">
                    <span className="mkt-ui-compose__logo">vemoki</span>
                    <span className="mkt-ui-compose__nav">{labels.navWallet}</span>
                  </div>
                  <div className="mkt-ui-compose__head">
                    <div>
                      <strong>{labels.walletTitle}</strong>
                      <span>{labels.walletSub}</span>
                    </div>
                    <span className="mkt-ui-compose__pill">{labels.demoPill}</span>
                  </div>
                  <div className="mkt-ui-compose__cards">
                    <article className="mkt-ui-ticket">
                      <div className="mkt-ui-ticket__art mkt-ui-ticket__art--mfest" />
                      <div className="mkt-ui-ticket__body">
                        <span className="mkt-ui-ticket__status">{labels.ticketUnused}</span>
                        <strong>MFest</strong>
                        <span>24/10 · 18:00 · HCM</span>
                        <code>DEMO-8K2P</code>
                      </div>
                    </article>
                    <article className="mkt-ui-ticket">
                      <div className="mkt-ui-ticket__art mkt-ui-ticket__art--river" />
                      <div className="mkt-ui-ticket__body">
                        <span className="mkt-ui-ticket__status">{labels.ticketUnused}</span>
                        <strong>{labels.eventRiver}</strong>
                        <span>31/10 · 19:00 · HCM</span>
                        <code>DEMO-3R7N</code>
                      </div>
                    </article>
                  </div>
                </div>
              ) : (
                <div className="mkt-ui-compose mkt-ui-compose--gate">
                  <div className="mkt-ui-compose__bar">
                    <span className="mkt-ui-compose__logo">vemoki</span>
                    <span className="mkt-ui-compose__nav">{labels.navGate}</span>
                  </div>
                  <div className="mkt-ui-gate">
                    <div className="mkt-ui-gate__scan">
                      <div className="mkt-ui-gate__frame" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                      <div className="mkt-ui-gate__qr" aria-hidden="true" />
                      <p>{labels.gateHint}</p>
                    </div>
                    <div className="mkt-ui-gate__side">
                      <span className="mkt-ui-compose__pill">{labels.demoPill}</span>
                      <p>{labels.gateOk}</p>
                      <ul>
                        <li>{labels.gateDup}</li>
                        <li>{labels.gateEvent}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="mkt-preview-phone" aria-hidden="true">
            <div className="mkt-phone-bezel">
              <div className="mkt-phone-notch" />
              <div className="mkt-phone-screen">
                <span className="mkt-ui-compose__pill mkt-ui-compose__pill--sm">
                  {labels.demoPill}
                </span>
                <strong>MFest</strong>
                <span className="mkt-phone-meta">{labels.phoneMeta}</span>
                <div className="mkt-phone-qr" aria-hidden="true" />
                <span className="mkt-phone-code">DEMO-8K2P</span>
              </div>
            </div>
          </div>
        </div>
        <p className="mkt-preview-caption">{labels.caption}</p>
      </div>
    </div>
  );
}
