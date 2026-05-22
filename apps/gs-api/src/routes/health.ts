import { Hono } from 'hono';
import { Env, Variables } from '../types';
import { getRuntimeVersion, withContractHeaders } from './contract';

const health = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * [SOP] Health & Heartbeat
 * Provides shallow and deep health checks for load balancers and gs-control.
 */
health.get('/', async (c) => {
  const isDeep = c.req.query('type') === 'deep';
  const timestamp = new Date().toISOString();

  const healthData: any = {
    status: 'ok',
    service: 'gs-api',
    timestamp,
    version: '2026.03.03'
  };

  if (isDeep) {
    try {
      // 1. Check KV Connectivity
      const kvCheck = await c.env.KV.get('SERVICE_STATUS');
      healthData.kv = kvCheck !== null ? 'connected' : 'empty';

      // 2. Check D1 Database Connectivity
      const dbCheck = await c.env.DB.prepare('SELECT 1').first();
      healthData.db = dbCheck ? 'connected' : 'error';
    } catch (error) {
      healthData.status = 'error';
      healthData.error = 'Dependency check failed';
    }
  }

  return c.json(
    withContractHeaders(healthData, getRuntimeVersion(c.env)),
    healthData.status === 'ok' ? 200 : 500
  );
});

export default health;
