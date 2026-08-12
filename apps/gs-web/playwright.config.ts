import { defineConfig } from '@playwright/test';

const browserName = process.env.PLAYWRIGHT_BROWSER === 'firefox'
  ? 'firefox'
  : 'chromium';
const executablePath =
  process.env.PLAYWRIGHT_EXECUTABLE_PATH ||
  process.env.PLAYWRIGHT_CHROMIUM_PATH ||
  (process.platform === 'linux'
    ? browserName === 'firefox'
      ? '/usr/bin/firefox-esr'
      : '/opt/pw-browsers/chromium'
    : undefined);
const testPort = Number(process.env.PLAYWRIGHT_PORT || 4321);
const launchOptions =
  browserName === 'firefox'
    ? { ...(executablePath ? { executablePath } : {}) }
    : {
        ...(executablePath ? { executablePath } : {}),
        args: ['--disable-gpu', '--use-angle=swiftshader', '--use-gl=swiftshader'],
      };

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${testPort}`,
    trace: 'retain-on-failure',
    ignoreHTTPSErrors: true,
    launchOptions,
  },
  webServer: {
    command: `pnpm dev --host 127.0.0.1 --port ${testPort}`,
    env: {
      PLAYWRIGHT_TEST: '1',
      // Astro 7 backgrounds dev servers in detected agent environments. The
      // Playwright webServer lifecycle needs the foreground process instead.
      ASTRO_DEV_BACKGROUND: '0',
    },
    port: testPort,
    reuseExistingServer: !process.env.CI,
  },
});
