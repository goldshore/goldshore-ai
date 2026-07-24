import { defineConfig } from "astro/config";
import baseConfig from "@goldshore/config/astro";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isPlaywright = process.env.PLAYWRIGHT_TEST === '1';
const isLocalDev = process.env.NODE_ENV !== 'production';

export default defineConfig({
  ...baseConfig,
  // Keep the Cloudflare adapter for production builds, but disable it for local
  // dev and Playwright runs so Astro can boot without the Workers runtime.
  adapter: isPlaywright || isLocalDev ? undefined : baseConfig.adapter,
  vite: {
    ...baseConfig.vite,
    server: isLocalDev ? { allowedHosts: true } : undefined,
    build: {
      // Disable minification to avoid lightningcss @keyframes issues
      minify: false
    },
    resolve: {
      ...baseConfig.vite?.resolve,
      alias: {
        ...baseConfig.vite?.resolve?.alias,
        '@goldshore/theme': path.resolve(__dirname, '../../packages/theme/src'),
        '@goldshore/ui': path.resolve(__dirname, '../../packages/ui'),
      }
    }
  }
});
