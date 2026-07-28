import { defineConfig } from "astro/config";
import baseConfig from "@goldshore/config/astro";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDevelopment = process.env.NODE_ENV !== 'production';
const isPlaywright = process.env.PLAYWRIGHT_TEST === '1';
const useCloudflareAdapter = !isDevelopment && !isPlaywright;

export default defineConfig({
  ...baseConfig,
  // Local dev and Playwright should use the lightweight Vite server; production still uses Cloudflare.
  adapter: useCloudflareAdapter ? baseConfig.adapter : undefined,
  vite: {
    ...baseConfig.vite,
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
