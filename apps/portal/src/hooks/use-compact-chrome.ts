'use client';

import { useEffect, useState } from 'react';

const COMPACT_MAX_WIDTH = 575;

function readCompact(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= COMPACT_MAX_WIDTH;
}

/** Narrow phone widths (390/360/320): shorter tab labels; full copy stays in panel body. */
export function useCompactChrome(): boolean {
  const [compact, setCompact] = useState(readCompact);

  useEffect(() => {
    const sync = () => setCompact(readCompact());
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  return compact;
}
