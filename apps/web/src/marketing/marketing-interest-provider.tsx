'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
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
import { t } from './copy';
import type { MarketingLocale } from './hosts';
import { InterestFormIsland } from './interest-form-island';

function interestHashActive() {
  if (typeof window === 'undefined') return false;
  return window.location.hash === '#interest';
}

function isInterestHref(href: string | null) {
  if (!href) return false;
  if (href === '#interest') return true;
  try {
    const url = new URL(href, window.location.href);
    return url.hash === '#interest';
  } catch {
    return href.endsWith('#interest');
  }
}

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
    if (typeof window !== 'undefined' && window.location.hash !== '#interest') {
      window.history.pushState(null, '', `${window.location.pathname}${window.location.search}#interest`);
    }
  }, []);

  const closeInterest = useCallback((next: boolean) => {
    setOpen(next);
    if (!next && typeof window !== 'undefined' && interestHashActive()) {
      const path = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, '', path);
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
    if (interestHashActive()) setOpen(true);
    const onHash = () => {
      if (interestHashActive()) setOpen(true);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target as Element | null;
      const anchor = target?.closest('a[href]');
      if (!anchor) return;
      if (!isInterestHref(anchor.getAttribute('href'))) return;
      event.preventDefault();
      openInterest();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [openInterest]);

  const title = t(locale, 'interest.title');
  const lead = t(locale, 'interest.lead');
  const form = <InterestFormIsland locale={locale} demo={demo} />;

  return (
    <>
      <span id="interest" className="sr-only" tabIndex={-1} />
      {children}
      {mobileSheet ? (
        <Sheet open={open} onOpenChange={closeInterest}>
          <SheetContent
            side="bottom"
            className="max-h-[min(92dvh,720px)] overflow-y-auto rounded-t-2xl border-line bg-paper px-4 pb-8 pt-6 text-ink scheme-light"
            data-testid="marketing-interest"
          >
            <SheetHeader className="text-left">
              <SheetTitle id="interest-title">{title}</SheetTitle>
              <SheetDescription>{lead}</SheetDescription>
            </SheetHeader>
            <div className="mt-4">{form}</div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={closeInterest}>
          <DialogContent
            className="max-h-[min(90dvh,820px)] max-w-[min(100%-2rem,560px)] overflow-y-auto border-line bg-paper text-ink scheme-light sm:max-w-[560px]"
            data-testid="marketing-interest"
            aria-labelledby="interest-title"
          >
            <DialogHeader>
              <DialogTitle id="interest-title">{title}</DialogTitle>
              <DialogDescription>{lead}</DialogDescription>
            </DialogHeader>
            <div className="mt-2">{form}</div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
