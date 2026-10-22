import { cva } from 'class-variance-authority';
import { withUiPrefix } from '../ui-tw.js';

/** Shared focus ring — Live Pulse v2 token `--color-focus` (3px). */
export const focusRingClass = withUiPrefix(
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
);

export const buttonVariants = cva(
  withUiPrefix(
    [
      'inline-flex items-center justify-center gap-2 font-semibold rounded-md transition-[color,opacity,background-color,border-color] duration-150',
      'disabled:pointer-events-none disabled:opacity-50',
      'aria-[busy=true]:cursor-wait',
      focusRingClass,
    ].join(' '),
  ),
  {
    variants: {
      variant: {
        primary: withUiPrefix('bg-signal text-white hover:opacity-95'),
        secondary: withUiPrefix(
          'border border-ink/20 bg-white text-ink hover:border-ink/40 hover:bg-paper',
        ),
        ghost: withUiPrefix('bg-transparent text-ink hover:bg-ink/5'),
        destructive: withUiPrefix('bg-destructive text-white hover:opacity-95'),
      },
      size: {
        sm: withUiPrefix('min-h-11 px-3 text-sm'),
        md: withUiPrefix('min-h-11 px-4 text-[0.95rem]'),
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export const inputVariants = cva(
  withUiPrefix(
    [
      'w-full min-h-11 rounded-md border bg-white px-3 text-ink',
      'placeholder:text-ink/45',
      'disabled:cursor-not-allowed disabled:opacity-50',
      focusRingClass,
    ].join(' '),
  ),
  {
    variants: {
      state: {
        default: withUiPrefix('border-line'),
        error: withUiPrefix('border-destructive aria-invalid:border-destructive'),
      },
    },
    defaultVariants: {
      state: 'default',
    },
  },
);

export const alertVariants = cva(withUiPrefix('grid gap-2 rounded-md border p-4 text-sm'), {
  variants: {
    variant: {
      default: withUiPrefix('border-line bg-paper text-ink'),
      destructive: withUiPrefix('border-destructive/40 bg-destructive/10 text-destructive'),
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export const cardVariants = cva(withUiPrefix('rounded-md border bg-white text-ink'), {
  variants: {
    variant: {
      elevated: withUiPrefix('border-line shadow-sm'),
      outline: withUiPrefix('border-line shadow-none'),
    },
  },
  defaultVariants: {
    variant: 'elevated',
  },
});
