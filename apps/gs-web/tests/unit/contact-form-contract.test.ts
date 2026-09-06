import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relativePath: string) =>
  readFile(new URL(`../../src/${relativePath}`, import.meta.url), 'utf8');

test('contact form submits through the canonical gs-web API proxy', async () => {
  const contactPage = await readSource('pages/contact.astro');
  const contactProxy = await readSource('pages/api/contact.ts');

  assert.match(contactPage, /fetch\('\/api\/contact'/);
  assert.doesNotMatch(contactPage, /fetch\('\/api\/forms\/contact\/submissions'/);
  assert.match(contactProxy, /'\/v1\/forms\/contact\/submissions'/);
});

test('contact form reports Turnstile and submission state inline', async () => {
  const source = await readSource('pages/contact.astro');

  assert.match(source, /id="contact-form-status"/);
  assert.match(source, /role="status"/);
  assert.match(source, /Please complete the bot verification before sending your message/);
  assert.doesNotMatch(source, /alert\(/);
});
