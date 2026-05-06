import fs from "node:fs";

const required = [
  "packages/brand/logo-penrose.svg",
  "packages/brand/logo-horizontal.svg",
  "packages/brand/favicon.svg",
  "packages/brand/brand.json"
];

const driftPatterns = [
  "apps/gs-admin/src/assets/logo.svg",
  "apps/gs-admin/public/assets/logo.svg",
  "apps/gs-web/src/assets/logo.svg"
];

let ok = true;

for (const f of required) {
  if (!fs.existsSync(f)) {
    console.error("MISSING:", f);
    ok = false;
  }
}

for (const f of driftPatterns) {
  if (!fs.existsSync(f)) continue;
  const s = fs.readFileSync(f, "utf8");
  const hasPointer = s.includes("packages/brand") || s.includes("CANONICAL_BRAND_ASSET");
  if (!hasPointer) {
    console.error("LOGO DRIFT (needs canonical pointer):", f);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log("repo:health OK");
