import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { health } from './routes/health';
import { user } from './routes/user';
import { system } from './routes/system';
import { pages } from './routes/pages';
import { media } from './routes/media';

// Minimal Durable Object for AuthSession
export class AuthSession {
  constructor(state: any, env: Env) {}
  async fetch(request: Request) {
    return new Response('AuthSession DO');
  }
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: ['https://goldshore.ai', 'https://www.goldshore.ai', 'https://admin.goldshore.ai'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'CF-Access-Jwt-Assertion'],
  credentials: true,
}));

app.route('/health', health);
app.route('/user', user);
app.route('/system', system);
app.route('/pages', pages);
app.route('/media', media);

app.get('/', (c) => c.json({ service: 'gs-api', ok: true }));

export default app;
