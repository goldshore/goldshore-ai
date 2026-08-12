import { handle } from '@astrojs/cloudflare/handler';

// Wrangler bundles this source entry point while Astro's production build
// emits the SSR manifest and static assets consumed by the Cloudflare handler.
// Keeping fetch here makes gs-web a Worker-with-Assets deployment rather than
// an assets-only upload.
export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    return handle(request, env as any, ctx as any);
  },
};
