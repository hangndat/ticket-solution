'use client';

import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import type { ReactNode } from 'react';

export type UiMotionProviderProps = {
  children: ReactNode;
  /** CSP nonce for Motion-injected style tags when tightening policy (#653). */
  nonce?: string;
};

/**
 * Lazy Motion + reduced-motion user preference. Wrap consumer islands only;
 * do not animate prod chrome until a design slice explicitly adds motion.
 */
export function UiMotionProvider({ children, nonce }: UiMotionProviderProps) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" nonce={nonce}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
