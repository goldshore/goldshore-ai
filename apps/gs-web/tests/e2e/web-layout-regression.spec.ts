import { expect, test } from '@playwright/test';

const leakedSourcePattern =
  /import\s+\w+\s+from\s+['"]|default-src\s+['"]self['"]|@goldshore\/theme\/styles/;

test('platform and Risk Radar retain the established theme without source leakage', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('ERR_CONNECTION_RESET')) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    if (!error.message.includes('ERR_CONNECTION_RESET')) {
      errors.push(error.message);
    }
  });

  await page.goto('/platform/', { waitUntil: 'networkidle' });
  await expect(page).toHaveTitle('Platform | GoldShore');
  await expect(page.locator('header.topbar')).toBeVisible();
  await expect(page.locator('footer.gs-theme-footer')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The GoldShore Platform');
  await expect(page.locator('body')).not.toContainText(leakedSourcePattern);
  await page.screenshot({ path: testInfo.outputPath('platform-desktop.png'), fullPage: true });

  await page.getByRole('link', { name: /Risk Radar/ }).first().click();
  await expect(page).toHaveURL(/\/risk-radar\/?$/);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('360° risk intelligence');
  await expect(page.locator('body')).not.toContainText(leakedSourcePattern);
  expect(errors).toEqual([]);
});
