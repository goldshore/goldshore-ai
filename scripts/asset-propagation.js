const fs = require('fs');
const path = require('path');

const TARGET_DIRS = ['apps', 'packages', 'public'];
const EXTENSIONS = new Set(['.astro', '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.html', '.css']);
const REPLACEMENTS = [
  [/goldshore-logo\.png/g, '/packages/brand/logo-penrose.svg'],
  [/(['"(])(?:\/assets\/brand\/)?logo\.png(['")])/g, '$1/packages/brand/logo-penrose.svg$2'],
  [/(['"(])(?:\/assets\/brand\/)?logo\.svg(['")])/g, '$1/packages/brand/logo-penrose.svg$2'],
  [/(['"(])\/assets\/penrose\.svg(['")])/g, '$1/packages/brand/logo-penrose.svg$2']
];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'coverage') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!EXTENSIONS.has(path.extname(entry.name))) continue;
    const original = fs.readFileSync(fullPath, 'utf8');
    let updated = original;
    for (const [matcher, replacement] of REPLACEMENTS) {
      updated = updated.replace(matcher, replacement);
    }
    if (updated !== original) {
      fs.writeFileSync(fullPath, updated);
      console.log('Updated references in', fullPath);
    }
  }
}

for (const dir of TARGET_DIRS) walk(dir);
