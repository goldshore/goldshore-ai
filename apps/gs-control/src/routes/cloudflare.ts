import { Hono } from 'hono';
import type { ControlEnv } from '../libs/types';

export const cloudflareRoutes = new Hono<{ Bindings: ControlEnv }>();

cloudflareRoutes.get('/health', (c) => c.json({ ok: true, service: 'cloudflare' }));
