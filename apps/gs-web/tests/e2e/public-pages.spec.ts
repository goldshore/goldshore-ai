import { expect, test } from '@playwright/test';

const attachPageMonitors = (page: import('@playwright/test').Page) => {
  const consoleErrors: string[] = [];
  const assetFailures: string[] = [];
  const assetLoads: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });

  page.on('response', (response) => {
    const type = response.request().resourceType();
    if (type === 'stylesheet' || type === 'script') {
      if (response.status() >= 400) {
        assetFailures.push(`${response.status()} ${response.url()}`);
      } else {
        assetLoads.push(response.url());
      }
    }
  });

  return { consoleErrors, assetFailures, assetLoads };
};

const assertHealthyPage = ({
  consoleErrors,
  assetFailures,
  assetLoads,
}: {
  consoleErrors: string[];
  assetFailures: string[];
  assetLoads: string[];
}) => {
  expect(
    consoleErrors,
    `Console errors detected:\n${consoleErrors.join('\n')}`,
  ).toEqual([]);
  expect(
    assetFailures,
    `Failed assets detected:\n${assetFailures.join('\n')}`,
  ).toEqual([]);
  expect(assetLoads.length, 'Expected CSS/JS assets to load.').toBeGreaterThan(
    0,
  );
};

test('home page renders core layout and CTA navigation', async ({ page }) => {
  const monitors = attachPageMonitors(page);

  await page.goto('/', { waitUntil: 'networkidle' });

  await expect(page.locator('header.gs-header')).toBeVisible();
  await expect(page.locator('footer.gs-footer')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Shaping Waves',
  );
  await expect(
    page.getByRole('link', { name: 'Start the Experience' }),
  ).toHaveAttribute('href', '/services');
  await expect(
    page.getByRole('link', { name: 'Contact Sales' }),
  ).toHaveAttribute('href', '/contact');
  await expect(
    page.getByRole('link', { name: 'Request Briefing' }).first(),
  ).toHaveAttribute('href', '/contact?inquiry=strategy-call');

  await page.getByRole('link', { name: 'Start the Experience' }).click();
  await page.waitForURL('**/services');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Services' }),
  ).toBeVisible();

  assertHealthyPage(monitors);
});

test('services page renders highlights and CTA', async ({ page }) => {
  const monitors = attachPageMonitors(page);

  await page.goto('/services', { waitUntil: 'networkidle' });

  await expect(
    page.getByRole('heading', { level: 1, name: 'Services' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Request a scoping call' }),
  ).toHaveAttribute('href', '/contact');
  await expect(page.locator('.gs-card').first()).toBeVisible();

  assertHealthyPage(monitors);
});

test('contact form submits and redirects to thank-you', async ({ page }) => {
  const monitors = attachPageMonitors(page);

  await page.goto('/contact', { waitUntil: 'networkidle' });

  await page.route('**/api/contact', async (route) => {
    await route.fulfill({
      status: 302,
      headers: {
        location: '/thank-you',
      },
    });
  });

  await page.getByLabel('Name').fill('Test User');
  await page.getByLabel('Work email').fill('test@example.com');
  await page
    .getByLabel('Project brief')
    .fill('Interested in a scoped engagement.');

  await Promise.all([
    page.waitForURL('**/thank-you'),
    page.getByRole('button', { name: 'Send message' }).click(),
  ]);

  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Thank you',
  );

  assertHealthyPage(monitors);
});

test('contact page preselects strategy-call inquiry from query string', async ({
  page,
}) => {
  const monitors = attachPageMonitors(page);

  await page.goto('/contact?inquiry=strategy-call', {
    waitUntil: 'networkidle',
  });

  await expect(page.getByLabel('Inquiry type')).toHaveValue('strategy-call');

  assertHealthyPage(monitors);
});

test('super bowl boxes page renders board and CTAs', async ({ page }) => {
  const monitors = attachPageMonitors(page);

  await page.goto('/super-bowl-boxes', { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Super Bowl',
  );
  await expect(page.locator('.sb-board__cell')).toHaveCount(100);
  await expect(page.getByRole('link', { name: 'View board' })).toHaveAttribute(
    'href',
    '#board',
  );
  await expect(
    page.getByRole('link', { name: 'How it works' }),
  ).toHaveAttribute('href', '#rules');

  assertHealthyPage(monitors);
});

test.describe('mobile navigation toggle', () => {
  test.use({ viewport: { width: 375, height: 900 } });

  test('opens and closes the primary nav menu', async ({ page }) => {
    const monitors = attachPageMonitors(page);

    await page.goto('/', { waitUntil: 'networkidle' });

    const header = page.locator('header.gs-header');
    const toggle = page.locator('.gs-nav-toggle');

    await expect(toggle).toBeVisible();
    await expect(header).toHaveAttribute('data-menu-open', 'false');

    await toggle.click();
    await expect(header).toHaveAttribute('data-menu-open', 'true');

    await toggle.click();
    await expect(header).toHaveAttribute('data-menu-open', 'false');

    assertHealthyPage(monitors);
  });
});
