import { defineConfig } from '@playwright/test';

const browserName = process.env.PLAYWRIGHT_BROWSER === 'firefox'
  ? 'firefox'
  : 'chromium';
const executablePath =
  process.env.PLAYWRIGHT_EXECUTABLE_PATH ||
  (browserName === 'firefox' ? '/usr/bin/firefox-esr' : '/usr/bin/chromium');
const launchOptions =
  browserName === 'firefox'
    ? { executablePath }
    : {
        executablePath,
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
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--disable-gpu', '--use-angle=swiftshader', '--use-gl=swiftshader'],
    },
  },
  webServer: {
    command: 'PLAYWRIGHT_TEST=1 pnpm dev -- --host 127.0.0.1 --port 4321',
    port: 4321,
    reuseExistingServer: !process.env.CI,
  },
});
