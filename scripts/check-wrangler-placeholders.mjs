import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

const TODO_PATTERN = /TODO_REPLACE_WITH_REAL_/;
const wranglerFiles = globSync("**/wrangler.toml", {
  exclude: ["**/node_modules/**", "**/.wrangler/**", "**/.git/**"],
});

const offenders = [];
for (const file of wranglerFiles) {
  const raw = readFileSync(file, "utf8");
  if (TODO_PATTERN.test(raw)) offenders.push(file);
}

if (offenders.length > 0) {
  console.error("Found unresolved Wrangler placeholder IDs in:");
  for (const file of offenders) console.error(`- ${file}`);
  process.exit(1);
}

console.log(`Wrangler placeholder check passed (${wranglerFiles.length} files scanned).`);
