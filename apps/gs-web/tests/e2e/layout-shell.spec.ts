import { expect, test } from '@playwright/test';

const leakedSourcePattern =
  /import\s+\w+\s+from\s+['"]|default-src\s+['"]self['"]|@goldshore\/theme\/styles/;

function monitorRuntimeErrors(page: import('@playwright/test').Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('platform and Risk Radar share the canonical shell without source leakage', async ({ page }, testInfo) => {
  const errors = monitorRuntimeErrors(page);

  await page.goto('/platform/', { waitUntil: 'networkidle' });
  await expect(page).toHaveTitle('Platform | GoldShore');
  await expect(page.locator('header.topbar')).toBeVisible();
  await expect(page.locator('footer.site-footer')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The GoldShore Platform');
  await expect(page.locator('body')).not.toContainText(leakedSourcePattern);
  await page.screenshot({ path: testInfo.outputPath('platform-desktop.png'), fullPage: true });

  await page.getByRole('link', { name: /Risk Radar/ }).first().click();
  await expect(page).toHaveURL(/\/risk-radar\/?$/);
  await expect(page).toHaveTitle('Risk Radar | GoldShore');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('360° risk intelligence');
  await expect(page.locator('body')).not.toContainText(leakedSourcePattern);
  await page.screenshot({ path: testInfo.outputPath('risk-radar-desktop.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test.describe('canonical shell on mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Risk Radar keeps its content and navigation usable', async ({ page }, testInfo) => {
    const errors = monitorRuntimeErrors(page);

    await page.goto('/risk-radar/', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const toggle = page.locator('.nav-toggle');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator('.topbar')).toHaveAttribute('data-menu-open', 'true');
    await expect(page.locator('.mobile-nav')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('risk-radar-mobile.png'), fullPage: true });
    expect(errors).toEqual([]);
  });
});
