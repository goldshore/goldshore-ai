import { Hono } from 'hono';

export const system = new Hono();

system.get('/status', (c) => c.json({
  status: 'operational',
  services: {
    db: 'connected',
    kv: 'connected',
    r2: 'connected'
  }
}));
