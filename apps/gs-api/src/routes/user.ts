import { Hono } from 'hono';

export const user = new Hono();

user.get('/me', (c) => {
  // In production, this would use Cloudflare Access headers via @goldshore/auth
  return c.json({
    id: 'user_123',
    email: 'admin@goldshore.ai',
    role: 'admin'
  });
});
