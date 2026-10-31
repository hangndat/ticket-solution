'use client';

/**
 * Secondary marketing CTAs (e.g. hero «Tư vấn») intentionally use native links with
 * `.mkt-neon-btn-secondary` instead of @ticket/ui `Button` — keeps hash/dialog behavior
 * and ink-surface styling without fighting CVA (DS-WEB-08).
 */

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { useMarketingInterest } from './marketing-interest-context';

type InterestCtaLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  href?: string;
};

/** Interest consultation CTA — always opens dialog/sheet (not hash-only navigation). */
export function InterestCtaLink({
  href = '#interest',
  onClick,
  ...props
}: InterestCtaLinkProps) {
  const { openInterest } = useMarketingInterest();

  return (
    <Link
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        openInterest();
        onClick?.(event);
      }}
    />
  );
}

type InterestCtaAnchorProps = ComponentProps<'a'>;

export function InterestCtaAnchor({ href = '#interest', onClick, ...props }: InterestCtaAnchorProps) {
  const { openInterest } = useMarketingInterest();

  return (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        openInterest();
        onClick?.(event);
      }}
    />
  );
}
