// Astro's Cloudflare handler subpath is resolved by the Astro/Vite build.
import { handle } from '@astrojs/cloudflare/handler';

type CloudflareHandleArgs = Parameters<typeof handle>;

export default {
  async fetch(
    request: CloudflareHandleArgs[0],
    env: CloudflareHandleArgs[1],
    ctx: CloudflareHandleArgs[2],
  ) {
    return handle(request, env, ctx);
  },
};
