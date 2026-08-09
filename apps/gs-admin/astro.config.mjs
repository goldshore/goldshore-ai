import { defineConfig } from 'astro/config';

const isLocalWindowsValidation = process.platform === 'win32' && process.env.CI !== 'true';
const cloudflareAdapter = isLocalWindowsValidation
  ? undefined
  : (await import('@astrojs/cloudflare')).default();

export default defineConfig({
  srcDir: './src',
  outDir: './dist',
  prefetch: true,
  site: 'https://admin.goldshore.ai',
  // Keep the Cloudflare adapter for production builds, but disable it for
  // local checks/builds on Windows so Astro does not boot the Workers runtime.
  adapter: isLocalWindowsValidation ? undefined : cloudflareAdapter,
  output: isLocalWindowsValidation ? 'static' : 'server',
  vite: {
    ssr: {
      noExternal: [
        '@goldshore/theme',
        '@goldshore/ui',
        '@goldshore/auth',
        '@goldshore/schema',
        '@goldshore/integrations',
        '@goldshore/utils',
      ],
    },
    resolve: {
      alias: {},
    },
  },
});
