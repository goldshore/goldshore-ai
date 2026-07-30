// Astro's Cloudflare handler subpath is resolved by the Astro/Vite build.
// @ts-expect-error TS2307: current astro check config does not use bundler resolution.
import { handle } from '@astrojs/cloudflare/handler';

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    return handle(request, env, ctx);
  },
};
