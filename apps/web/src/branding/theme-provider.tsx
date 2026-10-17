'use client';

import {
  createContext,
  useContext,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { brandingToCssVars } from './css-vars';
import type { TenantBranding } from './types';
import { VEMOKI_BRANDING } from './vemoki';

const BrandingContext = createContext<TenantBranding>(VEMOKI_BRANDING);

export function useBranding(): TenantBranding {
  return useContext(BrandingContext);
}

type Props = {
  branding: TenantBranding;
  children: ReactNode;
  /**
   * When true, apply CSS vars on a wrapper (tenant override scopes).
   * Root layout usually applies vars on <html> and sets applyCssVars=false.
   */
  applyCssVars?: boolean;
  className?: string;
  as?: 'div' | 'span';
};

/**
 * Provides tenant branding to chrome (Wordmark / BrandMark) and optionally
 * scopes CSS variables for nested surfaces.
 */
export function ThemeProvider({
  branding,
  children,
  applyCssVars = false,
  className,
  as: Tag = 'div',
}: Props) {
  const style: CSSProperties | undefined = applyCssVars
    ? brandingToCssVars(branding)
    : undefined;

  return (
    <BrandingContext.Provider value={branding}>
      {applyCssVars ? (
        <Tag
          className={className}
          style={style}
          data-branding-source={branding.source}
          data-tenant-slug={branding.tenantSlug ?? undefined}
        >
          {children}
        </Tag>
      ) : (
        children
      )}
    </BrandingContext.Provider>
  );
}
