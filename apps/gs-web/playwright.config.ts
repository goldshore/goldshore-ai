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
      : '/usr/bin/chromium'
    : undefined);
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
    baseURL: 'http://127.0.0.1:4321',
    trace: 'retain-on-failure',
    launchOptions,
  },
  webServer: {
    command: 'pnpm dev -- --host 127.0.0.1 --port 4321',
    env: {
      PLAYWRIGHT_TEST: '1',
    },
    port: 4321,
    reuseExistingServer: !process.env.CI,
  },
});
