'use client';

import { createContext, useContext } from 'react';

export type MarketingInterestContextValue = {
  openInterest: () => void;
};

export const MarketingInterestContext = createContext<MarketingInterestContextValue | null>(
  null,
);

export function useMarketingInterest() {
  const ctx = useContext(MarketingInterestContext);
  if (!ctx) {
    throw new Error('useMarketingInterest must be used within MarketingInterestProvider');
  }
  return ctx;
}
