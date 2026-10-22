export type DemoMetricProps = {
  label: string;
  value: string;
  className?: string;
};

/** Labeled metric card for marketing demo / outcomes sections (not live data). */
export function DemoMetric({ label, value, className }: DemoMetricProps) {
  return (
    <div className={className ?? 'mkt-metric'}>
      <div className="mkt-metric-label">{label}</div>
      <div className="mkt-metric-value">{value}</div>
    </div>
  );
}
