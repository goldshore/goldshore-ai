import { defineConfig } from "astro/config";
import baseConfig from "@goldshore/config/astro";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  ...baseConfig,
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
