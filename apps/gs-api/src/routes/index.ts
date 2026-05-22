import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';

// Route Imports
import pages from './routes/pages';
import internal from './routes/internal';
import ai from './routes/ai';
import admin from './routes/admin';
import system from './routes/system';
import media from './routes/media';
import health from './routes/health';
import templates from './routes/templates';
import user from './routes/user';
import users from './routes/users';

import { Env, Variables } from './types';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// 1. Global Middleware
app.use('*', secureHeaders());
app.use('*', cors({
  origin: (origin, c) => {
    const allowed = (c.env.ALLOWED_ORIGINS ?? "https://admin.goldshore.ai").split(",");
    return origin && allowed.map(s => s.trim()).includes(origin) ? origin : undefined;
  },
  credentials: true
}));

// 2. Lifecycle & Infrastructure Routes
app.route('/health', health);     // [SOP] Deep/Shallow health probes
app.route('/internal', internal); // [SOP] Aggregated system status for Admin
app.route('/system', system);     // Global configurations
app.route('/templates', templates); // API module documentation

// 3. Content & Asset Routes
app.route('/pages', pages);       // D1-backed CMS
app.route('/media', media);       // R2-backed secure assets

// 4. Intelligence & IAM Routes
app.route('/ai', ai);             // Orchestrated LLM gateway
app.route('/admin', admin);       // User management & Audit
app.route('/users', users);       // Session-aware user data
app.route('/user', user);         // Legacy redirect to /users

export default app;
