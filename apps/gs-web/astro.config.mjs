import { defineConfig } from 'astro/config';
import baseConfig from '@goldshore/config/astro';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isPlaywright = process.env.PLAYWRIGHT_TEST === '1';
const isLocalDev = process.env.NODE_ENV !== 'production';

export default defineConfig({
  ...baseConfig,
  // gs-web is an SSR Worker, not a static/Pages build. The Cloudflare adapter
  // emits the Worker entry point and its asset bundle together under dist/.
  output: 'server',
  // Sessions are enabled and KV-backed, for auth state alongside Cloudflare
  // Access. No `session` key is set on purpose: @astrojs/cloudflare applies its
  // own driver whenever none is configured (`if (!session?.driver)`), which is
  // exactly what we want here — it emits a SESSION binding into the generated
  // deploy manifest under the adapter's DEFAULT_SESSION_KV_BINDING_NAME
  // ("SESSION").
  //
  // The matching namespace is pinned in wrangler.toml. That pin matters: with
  // the binding emitted but unpinned, Cloudflare auto-provisions a namespace at
  // deploy time, which is how the live `goldshore-ai-session` namespace was
  // created in the first place.
  // Keep the Cloudflare adapter for production builds, but disable it for local
  // dev and Playwright runs so Astro can boot without the Workers runtime.
  adapter: isPlaywright || isLocalDev ? undefined : baseConfig.adapter,
  vite: {
    ...baseConfig.vite,
    server: isLocalDev ? { allowedHosts: true } : undefined,
    build: {
      // Disable minification to avoid lightningcss @keyframes issues
      minify: false,
    },
    resolve: {
      ...baseConfig.vite?.resolve,
      alias: {
        ...baseConfig.vite?.resolve?.alias,
        '@goldshore/theme': path.resolve(__dirname, '../../packages/theme/src'),
        '@goldshore/ui': path.resolve(__dirname, '../../packages/ui'),
      },
    },
  },
});
