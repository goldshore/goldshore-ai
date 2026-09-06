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

  // The homepage converts in place rather than routing to /contact: the hero
  // CTA scrolls to the "Engage" section, which carries its own inquiry form
  // posting to /api/contact. Assert the whole path, not just the href, so a
  // future change that breaks the anchor or drops the form is caught here.
  await expect(
    page.getByRole('link', { name: 'Request Briefing' }).first(),
  ).toHaveAttribute('href', '#engage');
  await expect(page.locator('#engage')).toBeAttached();
  await expect(page.locator('#engage form#quick-form')).toHaveAttribute(
    'action',
    '/api/contact',
  );


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

test('contact form submits and shows success message', async ({ page }) => {
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

  // The form posts to /api/contact, not /api/forms/contact/submissions.
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

  // Every field below is `required`; omitting sector or the engagement type
  // leaves the form invalid and the submit handler never runs.
  // Scope to #contact-form: the page also renders a secondary form with its
  // own "Name" field, so page-wide label lookups are ambiguous.
  const form = page.locator('#contact-form');
  await form.getByLabel('Name', { exact: true }).fill('Test User');
  await form.getByLabel('Email').fill('test@example.com');
  await form.getByLabel('Project or company').fill('Test Co');
  await form.getByLabel('Sector').selectOption('Financial services');
  await form.getByRole('radio', { name: 'Advisory' }).check();
  await form
    .getByLabel('What is the problem?')
    .fill('Interested in GoldShore services.');

  await form.getByRole('button', { name: 'Send message' }).click();

  // Success is reported in an aria-live region on the page, not a browser
  // dialog, so wait for that status text rather than a `dialog` event -- a
  // dialog listener that never fires would let this test pass without ever
  // confirming the submission succeeded.
  await expect(page.locator('#contact-form-status')).toContainText(
    'Thank you!',
  );

  assertHealthyPage(monitors);
});

test('contact page loads and renders form', async ({ page }) => {
  const monitors = attachPageMonitors(page);

  await page.goto('/contact', { waitUntil: 'networkidle' });

  await expect(
    page.getByRole('heading', { level: 1, name: 'Tell us what is not working.' }),
  ).toBeVisible();
  // Scope to #contact-form: the page also renders a secondary form with its
  // own "Name" field, so page-wide label lookups are ambiguous.
  const form = page.locator('#contact-form');
  await expect(form.getByLabel('Name', { exact: true })).toBeVisible();
  await expect(form.getByLabel('Email')).toBeVisible();
  await expect(form.getByLabel('Project or company')).toBeVisible();
  await expect(form.getByLabel('Sector')).toBeVisible();
  await expect(form.getByRole('group', { name: 'Engagement type' })).toBeVisible();
  await expect(form.getByLabel('What is the problem?')).toBeVisible();
  await expect(form.getByRole('button', { name: 'Send message' })).toBeVisible();

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
