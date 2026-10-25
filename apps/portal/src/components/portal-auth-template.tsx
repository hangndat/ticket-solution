'use client';

import type { ReactNode } from 'react';

/** Shared staff auth layout — centered card on paper background (DS-PORTAL-04). */
export function PortalAuthTemplate({ children }: { children: ReactNode }) {
  return (
    <div className="portal-auth-page">
      <div className="portal-auth-page__inner">{children}</div>
    </div>
  );
}
