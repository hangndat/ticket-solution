import type { HTMLAttributes } from 'react';
import { cn } from '../cn.js';
import { cardVariants } from './variants.js';
import type { VariantProps } from 'class-variance-authority';

export type CardProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>;

export function Card({ className, variant, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant }), className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('ui:flex ui:flex-col ui:gap-1.5 ui:p-5 ui:pb-0', className)} {...props} />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'ui:font-display ui:text-lg ui:font-bold ui:tracking-tight ui:text-ink',
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('ui:text-sm ui:text-ink/70', className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ui:p-5 ui:pt-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('ui:flex ui:items-center ui:p-5 ui:pt-0', className)} {...props} />
  );
}
