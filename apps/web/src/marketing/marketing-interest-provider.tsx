'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@ticket/ui/client';
import { cn } from '../../lib/utils';
import { t } from './copy';
import type { MarketingLocale } from './hosts';
import { InterestFormIsland } from './interest-form-island';
import { MarketingInterestContext } from './marketing-interest-context';
import {
  clearInterestHashFromHistory,
  interestHashActive,
  isInterestHref,
  setInterestHashInHistory,
} from './marketing-interest-hash';
import { marketingInterestLead, marketingInterestShell } from './marketing-surface';

export function MarketingInterestProvider({
  locale,
  demo,
  children,
}: {
  locale: MarketingLocale;
  demo: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mobileSheet, setMobileSheet] = useState(false);

  const openInterest = useCallback(() => {
    setOpen(true);
    setInterestHashInHistory();
  }, []);

  const closeInterest = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      clearInterestHashFromHistory();
    }
  }, []);

  const syncOpenFromLocation = useCallback(() => {
    if (interestHashActive()) {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const sync = () => setMobileSheet(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    syncOpenFromLocation();
    const onHash = () => syncOpenFromLocation();
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('popstate', onHash);
    };
  }, [syncOpenFromLocation]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest('a[href]');
      if (!anchor || !isInterestHref(anchor.getAttribute('href'))) return;
      event.preventDefault();
      openInterest();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [openInterest]);

  const contextValue = useMemo(() => ({ openInterest }), [openInterest]);

  const title = t(locale, 'interest.title');
  const lead = t(locale, 'interest.lead');
  const form = <InterestFormIsland locale={locale} demo={demo} />;

  return (
    <MarketingInterestContext.Provider value={contextValue}>
      <span id="interest" className="sr-only" tabIndex={-1} />
      {children}
      {mobileSheet ? (
        <Sheet open={open} onOpenChange={closeInterest}>
          <SheetContent
            side="bottom"
            className={cn(
              marketingInterestShell,
              'max-h-[min(92dvh,720px)] overflow-y-auto rounded-t-2xl px-4 pb-8 pt-6',
            )}
            data-testid="marketing-interest"
          >
            <SheetHeader className="text-left">
              <SheetTitle id="interest-title">{title}</SheetTitle>
              <SheetDescription className={marketingInterestLead}>
                {lead}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4">{form}</div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={closeInterest}>
          <DialogContent
            className={cn(
              marketingInterestShell,
              'max-h-[min(90dvh,820px)] max-w-[min(100%-2rem,560px)] overflow-y-auto sm:max-w-[560px]',
            )}
            data-testid="marketing-interest"
            aria-labelledby="interest-title"
          >
            <DialogHeader>
              <DialogTitle id="interest-title">{title}</DialogTitle>
              <DialogDescription className={marketingInterestLead}>
                {lead}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2">{form}</div>
          </DialogContent>
        </Dialog>
      )}
    </MarketingInterestContext.Provider>
  );
}
