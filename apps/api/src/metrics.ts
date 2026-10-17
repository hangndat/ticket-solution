import { timingSafeEqual } from 'node:crypto';
import {
  collectDbRuntimeMetrics,
  collectOutboxMetrics,
  getEventLoopLagSeconds,
  metricsObserveSeconds,
  renderPrometheusText,
  routeTemplateFromPath,
  startEventLoopLagMonitor,
  statusClass,
  type PrismaClient,
} from '@ticket/backend';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

export type MetricsEnv = {
  nodeEnv: string;
  metricsToken: string | null;
};

export function readMetricsEnvironment(env: NodeJS.ProcessEnv): MetricsEnv {
  const nodeEnv = env['NODE_ENV'] ?? 'development';
  const metricsToken = env['METRICS_TOKEN']?.trim() || null;
  return { nodeEnv, metricsToken };
}

/** Constant-time Bearer match; length mismatch rejects without timingSafeEqual throw. */
export function metricsBearerMatches(
  header: string | undefined,
  metricsToken: string,
): boolean {
  if (typeof header !== 'string') return false;
  const expected = Buffer.from(`Bearer ${metricsToken}`, 'utf8');
  const actual = Buffer.from(header, 'utf8');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/**
 * Register GET /metrics outside /v1 prefix.
 * Production without METRICS_TOKEN → 404 (disabled).
 * Missing/wrong Bearer → 401. Token never logged.
 */
export function registerMetricsEndpoint(
  app: NestFastifyApplication,
  options: {
    env: NodeJS.ProcessEnv;
    db: PrismaClient | null;
  },
): void {
  const fastify = app.getHttpAdapter().getInstance();
  const cfg = readMetricsEnvironment(options.env);
  startEventLoopLagMonitor();

  fastify.addHook('onRequest', async (req) => {
    (req as { __metricsStart?: bigint }).__metricsStart = process.hrtime.bigint();
  });

  fastify.addHook('onResponse', async (req, reply) => {
    const start = (req as { __metricsStart?: bigint }).__metricsStart;
    if (start === undefined) return;
    const seconds = Number(process.hrtime.bigint() - start) / 1_000_000_000;
    const routerPath =
      (req as { routeOptions?: { url?: string } }).routeOptions?.url ??
      req.url;
    const template = routeTemplateFromPath(routerPath);
    if (template === '/metrics') return;
    metricsObserveSeconds('http_request_duration_seconds', seconds, {
      route_template: template,
      method: req.method,
      status_class: statusClass(reply.statusCode),
    });
  });

  fastify.get('/metrics', async (req, reply) => {
    // Disabled in production when token unset — look like missing route.
    if (cfg.nodeEnv === 'production' && !cfg.metricsToken) {
      return reply.code(404).send({ message: 'Not Found' });
    }
    if (!cfg.metricsToken) {
      // Non-production without token: still require explicit opt-in via token.
      return reply.code(401).type('text/plain').send('unauthorized');
    }
    if (!metricsBearerMatches(req.headers.authorization, cfg.metricsToken)) {
      return reply.code(401).type('text/plain').send('unauthorized');
    }

    const extra: string[] = [];
    extra.push('# HELP process_event_loop_lag_seconds Event loop lag');
    extra.push('# TYPE process_event_loop_lag_seconds gauge');
    extra.push(
      `process_event_loop_lag_seconds ${getEventLoopLagSeconds()}`,
    );

    if (options.db) {
      try {
        const outbox = await collectOutboxMetrics(options.db);
        extra.push('# HELP outbox_oldest_age_seconds Oldest non-complete outbox age');
        extra.push('# TYPE outbox_oldest_age_seconds gauge');
        extra.push(`outbox_oldest_age_seconds ${outbox.oldestAgeSeconds}`);
        extra.push('# HELP outbox_pending_count Pending/leased outbox rows');
        extra.push('# TYPE outbox_pending_count gauge');
        extra.push(`outbox_pending_count ${outbox.pendingCount}`);
        extra.push('# HELP outbox_processing_count Processing outbox rows');
        extra.push('# TYPE outbox_processing_count gauge');
        extra.push(`outbox_processing_count ${outbox.processingCount}`);
        extra.push('# HELP outbox_error_count Dead or retried outbox rows');
        extra.push('# TYPE outbox_error_count gauge');
        extra.push(`outbox_error_count ${outbox.errorCount}`);

        const dbm = await collectDbRuntimeMetrics(options.db);
        extra.push('# HELP db_lock_waiting_backends Backends waiting on locks');
        extra.push('# TYPE db_lock_waiting_backends gauge');
        extra.push(`db_lock_waiting_backends ${dbm.lockWaiting}`);
      } catch {
        // Scrape should still return process metrics if DB briefly unavailable.
        extra.push('# HELP metrics_db_scrape_errors_total DB scrape failures');
        extra.push('# TYPE metrics_db_scrape_errors_total gauge');
        extra.push('metrics_db_scrape_errors_total 1');
      }
    }

    const body = renderPrometheusText(extra);
    return reply
      .code(200)
      .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
      .header('Cache-Control', 'no-store')
      .send(body);
  });
}
