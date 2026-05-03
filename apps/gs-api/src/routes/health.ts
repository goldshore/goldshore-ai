import { Hono } from 'hono';

export const health = new Hono();

health.get('/', (c) => c.json({ status: 'ok', service: 'gs-api', timestamp: new Date().toISOString() }));
