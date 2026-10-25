import { cva } from 'class-variance-authority';

/** Shared focus ring — Live Pulse v2 token `--color-focus` (3px). */
export const focusRingClass =
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-md font-semibold no-underline',
    'transition-[color,opacity,background-color,border-color,transform,filter] duration-150',
    'disabled:pointer-events-none disabled:opacity-50',
    'aria-[busy=true]:cursor-wait',
    focusRingClass,
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'border border-signal bg-signal text-white shadow-[0_4px_20px_color-mix(in_srgb,var(--color-signal)_35%,transparent)] hover:border-[color-mix(in_srgb,var(--color-signal)_88%,var(--color-ink))] hover:bg-[color-mix(in_srgb,var(--color-signal)_88%,var(--color-ink))] hover:-translate-y-px motion-reduce:hover:translate-y-0',
        /** Consumer attendee primary — restrained signal gradient (DEC-01). */
        attendeePrimary:
          'border border-transparent bg-gradient-to-br from-signal from-0% to-[color-mix(in_srgb,var(--color-signal)_88%,var(--color-ink))] to-100% text-paper shadow-[0_10px_28px_color-mix(in_srgb,var(--color-signal)_28%,transparent)] hover:opacity-95 hover:-translate-y-px motion-reduce:hover:translate-y-0',
        secondary:
          'border border-ink/20 bg-white text-ink hover:border-ink/40 hover:bg-paper',
        secondaryOnInk:
          'border border-white/22 bg-white/8 text-paper hover:bg-white/14',
        ghost: 'border border-transparent bg-transparent text-ink hover:bg-ink/5',
        ghostOnInk:
          'border border-transparent bg-transparent font-semibold text-inherit hover:bg-white/10',
        destructive: 'border border-transparent bg-destructive text-white hover:opacity-95',
        link:
          'min-h-0 border-0 bg-transparent px-0 text-ink underline-offset-4 hover:underline',
        brand:
          'border border-transparent bg-[var(--brand)] text-white hover:opacity-95',
      },
      size: {
        sm: 'min-h-11 px-3 text-sm',
        md: 'min-h-11 px-5 text-[0.9rem]',
        lg: 'min-h-11 px-5 text-base',
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      block: false,
    },
  },
);

export const inputVariants = cva(
  [
    'w-full min-h-11 rounded-md border bg-white px-3 text-ink',
    'placeholder:text-ink/45',
    'disabled:cursor-not-allowed disabled:opacity-50',
    focusRingClass,
  ].join(' '),
  {
    variants: {
      state: {
        default: 'border-line',
        error: 'border-destructive aria-invalid:border-destructive',
      },
    },
    defaultVariants: {
      state: 'default',
    },
  },
);

export const alertVariants = cva(
  'grid gap-2 rounded-2xl border p-4 text-sm',
  {
    variants: {
      variant: {
        default: 'border-line bg-paper text-ink',
        destructive:
          'border-destructive/40 bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export const cardVariants = cva('rounded-2xl border bg-white text-ink', {
  variants: {
    variant: {
      elevated: 'border-line shadow-sm',
      outline: 'border-line shadow-none',
    },
  },
  defaultVariants: {
    variant: 'elevated',
  },
});
