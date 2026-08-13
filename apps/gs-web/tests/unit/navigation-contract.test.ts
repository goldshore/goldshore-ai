import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import test from 'node:test';

import {
  adminLinks,
  authLinks,
  companyLinks,
  platformLinks,
  primaryNavLinks,
  serviceLinks,
} from '../../src/config/navigation.ts';

const pagesRoot = new URL('../../src/pages/', import.meta.url);

const pageCandidates = (href: string) => {
  const pathname = new URL(href, 'https://goldshore.ai').pathname.replace(/^\/+|\/+$/g, '');
  if (!pathname) return [new URL('index.astro', pagesRoot)];
  return [
    new URL(`${pathname}.astro`, pagesRoot),
    new URL(`${pathname}/index.astro`, pagesRoot),
    new URL(`${pathname}.ts`, pagesRoot),
  ];
};

const routeExists = async (href: string) => {
  for (const candidate of pageCandidates(href)) {
    try {
      await access(candidate);
      return true;
    } catch {
      // Try the next Astro route representation.
    }
  }
  return false;
};

test('every main navigation and footer destination has a real Astro route', async () => {
  const publicLinks = [
    ...primaryNavLinks,
    ...platformLinks,
    ...serviceLinks,
    ...companyLinks,
  ];

  for (const link of publicLinks) {
    assert.equal(
      await routeExists(link.href),
      true,
      `${link.label} points at missing route ${link.href}`,
    );
  }
});

test('dashboard navigation bypasses the retired gs-admin root', () => {
  assert.deepEqual(authLinks, [
    {
      href: 'https://admin.goldshore.ai/app/dashboard',
      label: 'Dashboard access',
      external: true,
    },
  ]);
});

test('admin footer links point to the canonical admin dashboard origin', () => {
  assert.deepEqual(adminLinks, [
    {
      href: 'https://admin.goldshore.ai/app/dashboard',
      label: 'Admin Dashboard',
      external: true,
    },
    {
      href: 'https://admin.goldshore.ai/login',
      label: 'Admin Login',
      external: true,
    },
  ]);
});
