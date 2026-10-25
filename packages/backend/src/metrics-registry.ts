/**
 * Minimal Prometheus text exposition helpers (no prom-client dependency).
 * Labels must stay low-cardinality: route_template / method / status_class /
 * channel / result — never raw path, user id, ticket id, or tokens.
 */

type Labels = Record<string, string>;

type CounterKey = string;
type HistKey = string;

const counters = new Map<CounterKey, number>();
const histograms = new Map<HistKey, number[]>();

const HIST_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

function labelKey(name: string, labels: Labels): string {
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels[k]}`);
  return `${name}|${parts.join(',')}`;
}

export function metricsInc(name: string, labels: Labels = {}, value = 1): void {
  const key = labelKey(name, labels);
  counters.set(key, (counters.get(key) ?? 0) + value);
}

export function metricsObserveSeconds(
  name: string,
  seconds: number,
  labels: Labels = {},
): void {
  const key = labelKey(name, labels);
  const arr = histograms.get(key) ?? [];
  arr.push(seconds);
  // Cap samples to bound memory in long-lived processes.
  if (arr.length > 10_000) arr.splice(0, arr.length - 5_000);
  histograms.set(key, arr);
}

export function metricsSetGauge(
  name: string,
  value: number,
  labels: Labels = {},
): void {
  const key = labelKey(name, labels);
  counters.set(key, value);
}

/** In-process quantile for worker log summaries (fixed, low-cardinality labels). */
export function metricsQuantileSeconds(
  name: string,
  labels: Labels,
  q: number,
): number {
  const samples = histograms.get(labelKey(name, labels));
  return samples
    ? quantile(
        [...samples].sort((a, b) => a - b),
        q,
      )
    : 0;
}

function parseKey(key: string): { name: string; labels: Labels } {
  const pipe = key.indexOf('|');
  const name = pipe < 0 ? key : key.slice(0, pipe);
  const rest = pipe < 0 ? '' : key.slice(pipe + 1);
  const labels: Labels = {};
  if (rest) {
    for (const part of rest.split(',')) {
      if (!part) continue;
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      const lk = part.slice(0, eq);
      const lv = part.slice(eq + 1);
      if (lk) labels[lk] = lv;
    }
  }
  return { name, labels };
}

function formatLabels(labels: Labels): string {
  const keys = Object.keys(labels);
  if (keys.length === 0) return '';
  return `{${keys.map((k) => `${k}="${labels[k]}"`).join(',')}}`;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * q) - 1),
  );
  const v = sorted[idx];
  return v === undefined ? 0 : v;
}

/** Render Prometheus text exposition (version 0.0.4). */
export function renderPrometheusText(extraGauges: string[] = []): string {
  const lines: string[] = [];
  const counterNames = new Set<string>();
  for (const key of counters.keys()) {
    counterNames.add(parseKey(key).name);
  }
  for (const name of [...counterNames].sort()) {
    lines.push(`# HELP ${name} ${name}`);
    lines.push(`# TYPE ${name} gauge`);
    for (const [key, value] of counters) {
      const parsed = parseKey(key);
      if (parsed.name !== name) continue;
      lines.push(`${name}${formatLabels(parsed.labels)} ${value}`);
    }
  }

  const histNames = new Set<string>();
  for (const key of histograms.keys()) {
    histNames.add(parseKey(key).name);
  }
  for (const name of [...histNames].sort()) {
    lines.push(`# HELP ${name} ${name}`);
    lines.push(`# TYPE ${name} histogram`);
    for (const [key, samples] of histograms) {
      const parsed = parseKey(key);
      if (parsed.name !== name) continue;
      const sorted = [...samples].sort((a, b) => a - b);
      for (const le of HIST_BUCKETS) {
        const cumulative = sorted.filter((s) => s <= le).length;
        const labels = { ...parsed.labels, le: String(le) };
        lines.push(`${name}_bucket${formatLabels(labels)} ${cumulative}`);
      }
      const infLabels = { ...parsed.labels, le: '+Inf' };
      lines.push(`${name}_bucket${formatLabels(infLabels)} ${sorted.length}`);
      const sum = sorted.reduce((a, b) => a + b, 0);
      lines.push(`${name}_sum${formatLabels(parsed.labels)} ${sum}`);
      lines.push(
        `${name}_count${formatLabels(parsed.labels)} ${sorted.length}`,
      );
      // Summary-style quantiles as companion gauges (p50/p95/p99).
      lines.push(
        `${name}_p50${formatLabels(parsed.labels)} ${quantile(sorted, 0.5)}`,
      );
      lines.push(
        `${name}_p95${formatLabels(parsed.labels)} ${quantile(sorted, 0.95)}`,
      );
      lines.push(
        `${name}_p99${formatLabels(parsed.labels)} ${quantile(sorted, 0.99)}`,
      );
    }
  }

  for (const g of extraGauges) {
    lines.push(g);
  }
  return lines.join('\n') + '\n';
}

export function resetMetricsForTests(): void {
  counters.clear();
  histograms.clear();
}

/** Map Fastify routerPath / raw url into low-cardinality route template. */
export function routeTemplateFromPath(path: string | undefined): string {
  if (!path) return 'unknown';
  let p = path.split('?')[0] ?? 'unknown';
  if (p.length > 200) p = p.slice(0, 200);
  // Collapse UUIDs and long hex tokens.
  p = p.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id',
  );
  p = p.replace(/\/[0-9a-f]{16,}/gi, '/:token');
  return p || 'unknown';
}

export function statusClass(code: number): string {
  if (code >= 500) return '5xx';
  if (code >= 400) return '4xx';
  if (code >= 300) return '3xx';
  if (code >= 200) return '2xx';
  return '1xx';
}

let eventLoopLagSeconds = 0;
let lagTimer: NodeJS.Timeout | null = null;

export function startEventLoopLagMonitor(): void {
  if (lagTimer) return;
  let expected = Date.now() + 1000;
  lagTimer = setInterval(() => {
    const now = Date.now();
    eventLoopLagSeconds = Math.max(0, (now - expected) / 1000);
    expected = now + 1000;
  }, 1000);
  lagTimer.unref?.();
}

export function getEventLoopLagSeconds(): number {
  return eventLoopLagSeconds;
}
