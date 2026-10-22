'use client';

import type { ReactNode } from 'react';
import { BentoRevealMotion } from './bento-reveal-motion';

/** Client island: lazy motion chunk loads with this boundary; children SSR in RSC. */
export function BentoReveal({ children }: { children: ReactNode }) {
  return <BentoRevealMotion>{children}</BentoRevealMotion>;
}
