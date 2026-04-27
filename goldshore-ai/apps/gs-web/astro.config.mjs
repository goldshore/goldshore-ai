import baseConfig from "@goldshore/config/astro";
import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";

export default defineConfig({
  ...baseConfig,
  output: "server",
  adapter: cloudflare(),
  // Web specific overrides if any
});
