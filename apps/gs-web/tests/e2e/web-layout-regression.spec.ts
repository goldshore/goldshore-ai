import { expect, test } from '@playwright/test';

const leakedSourcePattern =
  /import\s+\w+\s+from\s+['"]|default-src\s+['"]self['"]|@goldshore\/theme\/styles/;

test('platform and Risk Radar retain the established theme without source leakage', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      // Ignore network-related errors from external resources in test environment
      if (!text.includes('ERR_CONNECTION_RESET') &&
          !text.includes('ERR_CERT_AUTHORITY_INVALID') &&
          !text.includes('net::ERR_') &&
          !text.includes('the server responded with a status of 404')) {
        errors.push(text);
      }
    }
  });
  page.on('pageerror', (error) => {
    if (!error.message.includes('ERR_CONNECTION_RESET') &&
        !error.message.includes('ERR_CERT_AUTHORITY_INVALID')) {
      errors.push(error.message);
    }
  });

  await page.goto('/platform/', { waitUntil: 'networkidle' });
  await expect(page).toHaveTitle('Platform | GoldShore');
  await expect(page.locator('header.header')).toBeVisible();
  await expect(page.locator('footer.gs-footer')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The GoldShore Platform');
  await expect(page.locator('body')).not.toContainText(leakedSourcePattern);
  await page.screenshot({ path: testInfo.outputPath('platform-desktop.png'), fullPage: true });

  await page.getByRole('link', { name: /Risk Radar/ }).first().click();
  await expect(page).toHaveURL(/\/risk-radar\/?$/);
  // Wait for heading to be visible before asserting content
  await page.getByRole('heading', { level: 1 }).waitFor({ state: 'visible' });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('360° risk intelligence');
  await expect(page.locator('body')).not.toContainText(leakedSourcePattern);
  expect(errors).toEqual([]);
});
