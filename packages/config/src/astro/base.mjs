import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";

export function createAstroConfig(overrides = {}) {
  const baseNoExternal = [
    '@goldshore/theme',
    '@goldshore/ui',
    '@goldshore/auth'
  ];

  const extraNoExternal = overrides?.vite?.ssr?.noExternal || [];
  const mergedNoExternal = [...new Set([...baseNoExternal, ...extraNoExternal])];

  const config = {
    srcDir: './src',
    outDir: './dist',
    output: 'server',
    prefetch: true,
    adapter: cloudflare(),
    integrations: [],
    vite: {
      plugins: [],
      ssr: {
        noExternal: mergedNoExternal
      },
      resolve: {
        alias: {}
      }
    }
  };

  if (overrides.integrations) {
    config.integrations.push(...overrides.integrations);
  }

  const finalConfig = {
    ...config,
    ...overrides,
    vite: {
      ...config.vite,
      ...(overrides.vite || {}),
      plugins: [
        ...config.vite.plugins,
        ...(overrides.vite?.plugins || [])
      ],
      ssr: {
        ...config.vite.ssr,
        ...(overrides.vite?.ssr || {}),
        noExternal: mergedNoExternal
      },
      resolve: {
        ...config.vite.resolve,
        ...(overrides.vite?.resolve || {}),
        alias: {
          ...config.vite.resolve.alias,
          ...(overrides.vite?.resolve?.alias || {})
        }
      }
    }
  };

  finalConfig.integrations = [
    ...config.integrations,
    ...(overrides.integrations || [])
  ];

  return defineConfig(finalConfig);
}

export default createAstroConfig();
