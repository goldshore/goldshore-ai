import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../apps/gs-web/openapi');

async function run() {
  if (!fs.existsSync(ROOT)) {
    console.log(`Directory not found: ${ROOT}`);
    return;
  }
  const files = fs.readdirSync(ROOT);

  for (const file of files) {
    if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;

    const yamlData = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const parsed = YAML.parse(yamlData);

    const jsonOut = file.replace(/\.ya?ml$/, '.json');

    // Target 1: src/content/openapi (as per instructions)
    const target1 = path.join(ROOT, '../src/content/openapi', jsonOut);
    fs.mkdirSync(path.dirname(target1), { recursive: true });
    fs.writeFileSync(target1, JSON.stringify(parsed, null, 2));
    console.log(`Wrote ${target1}`);

    // Target 2: apps/gs-web/public/openapi (standard static assets)
    const target2 = path.join(ROOT, '../public/openapi', jsonOut);
    fs.mkdirSync(path.dirname(target2), { recursive: true });
    fs.writeFileSync(target2, JSON.stringify(parsed, null, 2));
    console.log(`Wrote ${target2}`);
  }
}

run();
