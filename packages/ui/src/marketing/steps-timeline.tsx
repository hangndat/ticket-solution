import { cn } from '../cn.js';

export type StepTimelineItem = {
  id: string;
  label: string;
  visualVariant: 1 | 2 | 3 | 4 | 5;
};

export type StepsTimelineProps = {
  steps: StepTimelineItem[];
  className?: string;
};

const stepVisualClass: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'before:absolute before:top-3.5 before:left-3.5 before:h-2.5 before:w-[42%] before:rounded before:bg-ink/10',
  2: '',
  3: 'after:border after:border-line after:bg-white after:bg-[linear-gradient(90deg,var(--color-ink)_2px,transparent_2px),linear-gradient(var(--color-ink)_2px,transparent_2px)] after:bg-size-[8px_8px] after:bg-position-[50%_50%] after:inset-2.5',
  4: 'after:bg-[radial-gradient(circle_at_70%_30%,color-mix(in_srgb,var(--color-admit)_35%,transparent),transparent_55%),linear-gradient(135deg,color-mix(in_srgb,var(--color-ink)_90%,black),color-mix(in_srgb,var(--color-ink)_70%,var(--color-muted)))]',
  5: 'after:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-signal)_50%,transparent)_35%,color-mix(in_srgb,var(--color-signal)_15%,transparent)_35%_55%,color-mix(in_srgb,var(--color-focus)_35%,transparent)_55%)]',
};

export function StepsTimeline({ steps, className }: StepsTimelineProps) {
  return (
    <ol
      className={cn(
        'relative mt-10 grid gap-5 min-[900px]:grid-cols-5 min-[900px]:gap-3',
        'min-[900px]:before:absolute min-[900px]:before:top-[22px] min-[900px]:before:right-[10%] min-[900px]:before:left-[10%] min-[900px]:before:z-0 min-[900px]:before:h-0.5 min-[900px]:before:bg-gradient-to-r min-[900px]:before:from-line min-[900px]:before:via-signal min-[900px]:before:to-line',
        className,
      )}
    >
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={cn(
            'relative z-[1] rounded-md border border-line bg-paper p-4 max-[899px]:grid max-[899px]:grid-cols-[44px_1fr] max-[899px]:gap-x-3.5 max-[899px]:gap-y-2.5',
            'min-[900px]:border-0 min-[900px]:bg-transparent min-[900px]:p-0 min-[900px]:px-2 min-[900px]:text-center',
          )}
        >
          <div
            className={cn(
              'grid size-11 shrink-0 place-items-center rounded-full border-2 border-line bg-paper font-display text-base font-bold text-ink shadow-sm',
              'min-[900px]:mx-auto min-[900px]:mb-4',
            )}
            aria-hidden="true"
          >
            {index + 1}
          </div>
          <p
            className={cn(
              'm-0 self-center text-[0.85rem] leading-snug text-muted',
              'min-[900px]:mb-0',
            )}
          >
            {step.label}
          </p>
          <div
            className={cn(
              'relative col-span-2 mt-2 h-16 overflow-hidden rounded-sm border border-line bg-gradient-to-br from-[color-mix(in_srgb,var(--color-ink)_8%,var(--color-paper))] to-paper',
              'after:absolute after:inset-3 after:rounded-md after:bg-gradient-to-r after:from-signal/15 after:to-focus/10',
              stepVisualClass[step.visualVariant],
              'min-[900px]:col-span-1 min-[900px]:mt-3 min-[900px]:h-14',
            )}
            aria-hidden="true"
          />
        </li>
      ))}
    </ol>
  );
}
