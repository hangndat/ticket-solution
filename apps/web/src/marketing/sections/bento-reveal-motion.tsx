'use client';

import { UiMotionProvider } from '@ticket/ui/client';
import { m, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

export function BentoRevealMotion({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return children;
  }

  return (
    <UiMotionProvider>
      <m.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-48px 0px' }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </m.div>
    </UiMotionProvider>
  );
}
