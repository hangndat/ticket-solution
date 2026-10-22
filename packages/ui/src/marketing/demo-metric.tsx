import { cn } from '../cn.js';

export type DemoMetricProps = {
  label: string;
  value: string;
  className?: string;
};

/** Labeled metric card for marketing demo / outcomes sections (not live data). */
export function DemoMetric({ label, value, className }: DemoMetricProps) {
  return (
    <div
      className={cn(
        'rounded-md border border-paper/10 bg-paper/5 p-[1.35rem]',
        className,
      )}
    >
      <div className="mb-1.5 text-[0.8rem] text-paper/65">{label}</div>
      <div className="font-display text-[2rem] font-bold tracking-tight">{value}</div>
    </div>
  );
}
