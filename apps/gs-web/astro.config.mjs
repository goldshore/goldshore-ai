import { defineConfig, sessionDrivers } from 'astro/config';
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
  // Authentication is established by Cloudflare Access and gs-api; gs-web uses
  // no Astro sessions. It must also declare no SESSION binding — see the
  // "gs-web has no direct operational or session bindings" contract test.
  //
  // `session: false` did not achieve that and is not even a valid value (the
  // schema expects an object), so it broke every build. It also would not have
  // helped: @astrojs/cloudflare enables its KV session driver whenever no
  // driver is set (`if (!session?.driver)`), emits a SESSION binding into the
  // generated manifest, and Cloudflare then auto-provisions the namespace at
  // deploy time — which is where the live `goldshore-ai-session` namespace came
  // from.
  //
  // Supplying an explicit non-KV driver is what actually disables that path.
  // `memory` is per-isolate and needs no Cloudflare resource, so no binding is
  // emitted and nothing is provisioned. Preferred over the `null` driver so
  // that any future session use fails visibly rather than silently discarding
  // writes.
  session: { driver: sessionDrivers.memory() },
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
