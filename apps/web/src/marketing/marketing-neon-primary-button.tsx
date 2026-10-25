import { Button } from '@ticket/ui';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

type MarketingNeonPrimaryButtonProps = ComponentProps<typeof Button>;

/**
 * Neon gradient primary CTA for marketing only (DEC-03).
 * `variant="ghost"` avoids @ticket/ui `primary` CVA fighting scoped `.mkt-neon-btn-primary`.
 */
export function MarketingNeonPrimaryButton({
  className,
  variant: _variant,
  ...props
}: MarketingNeonPrimaryButtonProps) {
  return (
    <Button variant="ghost" className={cn('mkt-neon-btn-primary', className)} {...props} />
  );
}
