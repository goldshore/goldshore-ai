#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const clientDir = path.join(distDir, 'client');
const astroDir = path.join(clientDir, '_astro');
const indexPath = path.join(clientDir, 'index.html');
const serverEntryPath = path.join(distDir, 'server', 'entry.mjs');
const webAppRoot = path.resolve('.');
const canonicalLayoutPath = path.join(webAppRoot, 'src', 'layouts', 'WebLayout.astro');
const publicDir = path.join(webAppRoot, 'public');

const errors = [];

if (!existsSync(distDir)) {
  errors.push(`Missing dist directory: ${distDir}`);
}

if (!existsSync(indexPath) && !existsSync(serverEntryPath)) {
  errors.push(`Missing both static index and server entrypoint: ${indexPath}, ${serverEntryPath}`);
}

const astroFiles = existsSync(astroDir) ? readdirSync(astroDir) : [];
const cssFiles = astroFiles.filter((file) => file.endsWith('.css'));
const jsFiles = astroFiles.filter((file) => file.endsWith('.js'));

if (cssFiles.length === 0) {
  errors.push('No CSS bundles found at dist/_astro/*.css');
}

if (jsFiles.length === 0) {
  errors.push('No JS bundles found at dist/_astro/*.js');
}

if (existsSync(indexPath)) {
  const indexHtml = readFileSync(indexPath, 'utf8');

  if (!indexHtml.includes('<link')) {
    errors.push('index.html does not include any <link tags.');
  }

  if (!indexHtml.includes('/_astro/')) {
    errors.push('index.html does not reference /_astro/ assets.');
  }

  if (!indexHtml.includes('<script')) {
    errors.push('index.html does not include any <script tags.');
  }
}

if (!existsSync(canonicalLayoutPath)) {
  errors.push(`Missing layout file: ${canonicalLayoutPath}`);
} else {
  const layoutSource = readFileSync(canonicalLayoutPath, 'utf8');
  const iconLinkPattern = /<link\s+[^>]*rel=["']icon["'][^>]*>/gi;
  const hrefPattern = /\shref=["']([^"']+)["']/i;
  const declaredIconHrefs = [...layoutSource.matchAll(iconLinkPattern)]
    .map((tagMatch) => {
      const hrefMatch = tagMatch[0].match(hrefPattern);
      return hrefMatch?.[1] ?? null;
    })
    .filter((href) => typeof href === 'string');

  if (declaredIconHrefs.length === 0) {
    errors.push(`No favicon <link rel="icon"> tags found in ${canonicalLayoutPath}`);
  }

  for (const href of declaredIconHrefs) {
    if (!href.startsWith('/')) {
      errors.push(`Favicon path must be root-relative: "${href}"`);
      continue;
    }

    const publicAssetPath = path.join(publicDir, href.slice(1));
    if (!existsSync(publicAssetPath)) {
      errors.push(`Missing favicon asset for "${href}" at ${publicAssetPath}`);
    }
  }
}

if (errors.length > 0) {
  console.error('❌ gs-web dist integrity check failed:\n');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('✅ gs-web dist integrity check passed');
console.log(`- Rendering: ${existsSync(indexPath) ? 'prerendered index' : 'server-rendered index'}`);
console.log(`- CSS bundles: ${cssFiles.length}`);
console.log(`- JS bundles: ${jsFiles.length}`);
