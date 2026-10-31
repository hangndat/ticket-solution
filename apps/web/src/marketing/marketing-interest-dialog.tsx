'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@ticket/ui/client';
import { InterestFormIsland } from './interest-form-island';
import { t } from './copy';
import type { MarketingLocale } from './hosts';

export function MarketingInterestDialog({ locale, demo, children }: { locale: MarketingLocale; demo: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const sync = () => setOpen(window.location.hash === '#interest');
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest('a[href]');
      if (!anchor) return;
      const url = new URL(anchor.getAttribute('href')!, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || url.hash !== '#interest') return;
      event.preventDefault();
      trigger.current = anchor as HTMLElement;
      window.history.pushState(null, '', '#interest');
      setOpen(true);
    };
    sync();
    document.addEventListener('click', onClick, true);
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next && window.location.hash === '#interest') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  return <>
    {children}
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto bg-paper text-ink sm:max-w-xl" data-testid="marketing-interest" onCloseAutoFocus={(event) => { if (trigger.current?.isConnected) { event.preventDefault(); trigger.current.focus(); } }}>
        <DialogHeader>
          <DialogTitle>{t(locale, 'interest.title')}</DialogTitle>
          <DialogDescription>{t(locale, 'interest.lead')}</DialogDescription>
        </DialogHeader>
        <InterestFormIsland locale={locale} demo={demo} />
      </DialogContent>
    </Dialog>
  </>;
}
