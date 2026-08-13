import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  getPublicSiteOrigin,
  getPublicSiteUrl,
} from '../../src/utils/public-site.ts';

const sourceRoot = new URL('../../src/', import.meta.url);

test('maps admin aliases to their matching public site', () => {
  assert.equal(getPublicSiteOrigin('admin.goldshore.ai'), 'https://goldshore.ai');
  assert.equal(getPublicSiteOrigin('admin.goldshore.org'), 'https://goldshore.org');
  assert.equal(
    getPublicSiteUrl('admin.goldshore.ai', '/contact/'),
    'https://goldshore.ai/contact/',
  );
  assert.equal(
    getPublicSiteUrl('admin.goldshore.org', '/services/'),
    'https://goldshore.org/services/',
  );
});

test('public chrome does not emit host-relative navigation on admin aliases', async () => {
  const [header, footer, notFound, sidebar] = await Promise.all([
    readFile(new URL('components/PublicHeader.astro', sourceRoot), 'utf8'),
    readFile(new URL('components/PublicFooter.astro', sourceRoot), 'utf8'),
    readFile(new URL('components/DefaultPageTemplate.astro', sourceRoot), 'utf8'),
    readFile(new URL('components/Sidebar.astro', sourceRoot), 'utf8'),
  ]);

  assert.match(header, /href=\{publicUrl\('\/'\)\}/);
  assert.match(header, /href=\{publicUrl\(link\.href\)\}/);
  assert.match(footer, /href=\{publicUrl\('\/'\)\}/);
  assert.match(notFound, /href=\{publicHomeUrl\}/);
  assert.match(sidebar, /href=\{PUBLIC_SITE_ORIGIN\}/);
});
