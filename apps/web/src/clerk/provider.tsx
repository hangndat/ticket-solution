'use client';

import { ClerkProvider } from '@clerk/nextjs';
import type { ReactNode } from 'react';

/** Client boundary for ClerkProvider — only mounted when keys are configured. */
export function ClerkConfiguredProvider({ children }: { children: ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
