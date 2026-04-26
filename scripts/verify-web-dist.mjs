#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const astroDir = path.join(distDir, '_astro');
const indexPath = path.join(distDir, 'index.html');

const errors = [];

if (!existsSync(distDir)) {
  errors.push(`Missing dist directory: ${distDir}`);
}

if (!existsSync(indexPath)) {
  errors.push(`Missing index.html: ${indexPath}`);
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

if (errors.length > 0) {
  console.error('❌ gs-web dist integrity check failed:\n');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('✅ gs-web dist integrity check passed');
console.log(`- CSS bundles: ${cssFiles.length}`);
console.log(`- JS bundles: ${jsFiles.length}`);
