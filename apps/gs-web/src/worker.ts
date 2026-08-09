import { handle } from '@astrojs/cloudflare/handler';

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    return handle(request, env as any, ctx as any);
  },
};
