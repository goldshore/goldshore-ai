import { Hono, type Context } from 'hono';
import type { Env, Variables } from '../types';
import { getRuntimeVersion, withContractHeaders } from './contract';

const health = new Hono<{ Bindings: Env; Variables: Variables }>();

const REQUIRED_BINDINGS = [
  'KV',
  'PLATFORM_DB',
  'GS_ASSETS',
  'MAIL_ARCHIVE',
  'MAIL_JOBS_QUEUE',
  'EMAIL',
  'AI',
] as const;

type RequiredBinding = (typeof REQUIRED_BINDINGS)[number];
type DependencyStatus = 'ready' | 'missing' | 'error';

export type DependencyReport = {
  ready: boolean;
  checkedAt: string;
  dependencies: Record<RequiredBinding, DependencyStatus>;
};

export async function getDependencyReport(env: Partial<Env>): Promise<DependencyReport> {
  const dependencies = Object.fromEntries(
    REQUIRED_BINDINGS.map((binding) => [binding, env[binding] ? 'ready' : 'missing']),
  ) as Record<RequiredBinding, DependencyStatus>;

  if (dependencies.KV === 'ready') {
    try {
      await env.KV?.get('__health__');
    } catch {
      dependencies.KV = 'error';
    }
  }

  if (dependencies.PLATFORM_DB === 'ready') {
    try {
      await env.PLATFORM_DB?.prepare('SELECT 1').first();
    } catch {
      dependencies.PLATFORM_DB = 'error';
    }
  }

  return {
    ready: Object.values(dependencies).every((status) => status === 'ready'),
    checkedAt: new Date().toISOString(),
    dependencies,
  };
}

export async function readinessHandler(
  c: Context<{ Bindings: Env; Variables: Variables }>,
) {
  const report = await getDependencyReport(c.env);
  return c.json(
    withContractHeaders(
      {
        status: report.ready ? 'ready' : 'not_ready',
        service: 'gs-api',
        timestamp: report.checkedAt,
        dependencySummary: {
          ready: Object.values(report.dependencies).filter((value) => value === 'ready').length,
          total: REQUIRED_BINDINGS.length,
        },
      },
      getRuntimeVersion(c.env),
    ),
    report.ready ? 200 : 503,
  );
}

export async function dependencyDetailsHandler(
  c: Context<{ Bindings: Env; Variables: Variables }>,
) {
  const report = await getDependencyReport(c.env);
  return c.json(
    withContractHeaders(
      {
        status: report.ready ? 'ready' : 'not_ready',
        service: 'gs-api',
        timestamp: report.checkedAt,
        dependencies: report.dependencies,
      },
      getRuntimeVersion(c.env),
    ),
    report.ready ? 200 : 503,
  );
}

/**
 * Liveness never touches a storage, queue, AI, or mail binding. Deep probes are
 * retained for compatibility and delegate to the explicit readiness checks.
 */
health.get('/', async (c) => {
  if (c.req.query('type') === 'deep') return readinessHandler(c);

  const payload = withContractHeaders(
    {
      status: 'ok',
      service: 'gs-api',
      timestamp: new Date().toISOString(),
      version: getRuntimeVersion(c.env),
    },
    getRuntimeVersion(c.env),
  );
  return c.json(payload, 200);
});

export default health;
