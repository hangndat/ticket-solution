import type {
  MarketingAnalyticsEventName,
  MarketingAnalyticsProps,
} from './events';

export type MarketingAnalyticsAdapter = {
  record(event: MarketingAnalyticsEventName, props: MarketingAnalyticsProps): void;
};

const noopAdapter: MarketingAnalyticsAdapter = {
  record() {
    /* fail-silent */
  },
};

let serverAdapter: MarketingAnalyticsAdapter = noopAdapter;

export function setMarketingAnalyticsAdapter(
  adapter: MarketingAnalyticsAdapter,
): void {
  serverAdapter = adapter;
}

export function trackMarketingEvent(
  event: MarketingAnalyticsEventName,
  props: MarketingAnalyticsProps = {},
): void {
  try {
    serverAdapter.record(event, props);
  } catch {
    /* fail-silent */
  }
}

export function defaultServerAdapter(): MarketingAnalyticsAdapter {
  return {
    record(event, props) {
      if (process.env.NODE_ENV !== 'production') {
        console.info('[marketing-analytics]', event, props);
      }
    },
  };
}
