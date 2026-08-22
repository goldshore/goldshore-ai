import { expect, test } from '@playwright/test';

const attachPageMonitors = (page: import('@playwright/test').Page) => {
  const consoleErrors: string[] = [];
  const assetFailures: string[] = [];
  const assetLoads: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      // Ignore network-related errors from external resources in test environment
      // These are expected in CI/test environments with proxy/certificate issues
      if (!text.includes('ERR_CONNECTION_RESET') &&
          !text.includes('ERR_CERT_AUTHORITY_INVALID') &&
          !text.includes('net::ERR_') &&
          !text.includes('the server responded with a status of 404')) {
        consoleErrors.push(text);
      }
    }
  });

  page.on('pageerror', (error) => {
    // Ignore network errors from page errors as well
    if (!error.message.includes('ERR_CONNECTION_RESET') &&
        !error.message.includes('ERR_CERT_AUTHORITY_INVALID')) {
      consoleErrors.push(error.message);
    }
  });

  page.on('response', (response) => {
    const type = response.request().resourceType();
    const url = response.url();
    // Only track failures for critical assets (stylesheets, scripts) that are from our domain
    if ((type === 'stylesheet' || type === 'script') && url.includes('127.0.0.1')) {
      if (response.status() >= 400) {
        assetFailures.push(`${response.status()} ${url}`);
      } else {
        assetLoads.push(url);
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

  await expect(page.locator('header.topbar')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Request Briefing' }).first(),
  ).toHaveAttribute('href', /\/contact\/$/);

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

test('contact form submits and redirects to confirmation', async ({ page }) => {
  const monitors = attachPageMonitors(page);

  // Mock Turnstile widget before page loads
  await page.addInitScript(() => {
    (window as any).turnstile = {
      render: () => 'mock-token',
      getResponse: () => 'mock-turnstile-token',
      reset: () => {},
    };
  });

  await page.goto('/contact', { waitUntil: 'networkidle' });

  await page.route('/api/contact', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        ok: true,
        submissionId: '123',
      }),
    });
  });

  await page.getByLabel('Name').fill('Test User');
  await page.getByLabel('Email').fill('test@example.com');
  await page
    .getByLabel('Project or company')
    .fill('Example Corp');
  await page.getByLabel('Sector').selectOption('Financial services');
  await page.getByLabel('Advisory').check();
  await page
    .getByLabel('What is the problem?')
    .fill('Interested in a scoped engagement.');

  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('#contact-form-status')).toContainText('Thank you');

  assertHealthyPage(monitors);
});

test('contact page renders engagement form', async ({
  page,
}) => {
  const monitors = attachPageMonitors(page);

  await page.goto('/contact', {
    waitUntil: 'networkidle',
  });

  await expect(page.getByText('Engagement type')).toBeVisible();
  await expect(page.getByLabel('Advisory')).toBeVisible();

  assertHealthyPage(monitors);
});

test('risk radar app page renders reusable system surface', async ({ page }) => {
  const monitors = attachPageMonitors(page);

  await page.goto('/apps/risk-radar', { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Operational risk visualization',
  );
  await expect(
    page.getByRole('heading', { name: 'GoldShore Risk Radar' }),
  ).toBeVisible();
  await expect(page.locator('.risk-page__stats article')).toHaveCount(3);

  assertHealthyPage(monitors);
});

test.describe('mobile navigation toggle', () => {
  test.use({ viewport: { width: 375, height: 900 } });

  test('opens and closes the primary nav menu', async ({ page }) => {
    const monitors = attachPageMonitors(page);

    await page.goto('/', { waitUntil: 'networkidle' });

    const toggle = page.locator('.nav-toggle');
    const nav = page.locator('header.topbar nav');

    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(nav).toHaveClass(/nav-open/);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    assertHealthyPage(monitors);
  });
});
