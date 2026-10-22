import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Slot as SlotPrimitive } from 'radix-ui';
import { cn } from '../cn.js';
import { buttonVariants } from './variants.js';
import type { VariantProps } from 'class-variance-authority';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    loadingLabel?: string;
    asChild?: boolean;
  };

function ButtonSpinner() {
  return (
    <svg
      className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

export function Button({
  className,
  variant,
  size,
  block,
  loading = false,
  loadingLabel = 'Đang xử lý…',
  disabled,
  children,
  type = 'button',
  asChild = false,
  ...props
}: ButtonProps) {
  const isDisabled = Boolean(disabled || loading);
  let content: ReactNode = children;
  if (loading && !asChild) {
    content = (
      <>
        <ButtonSpinner />
        <span>{loadingLabel}</span>
      </>
    );
  }

  const classes = cn(buttonVariants({ variant, size, block }), className);

  if (asChild) {
    return (
      <SlotPrimitive.Root
        className={classes}
        aria-busy={loading || undefined}
        data-loading={loading ? '' : undefined}
        {...props}
      >
        {children}
      </SlotPrimitive.Root>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-loading={loading ? '' : undefined}
      {...props}
    >
      {content}
    </button>
  );
}
