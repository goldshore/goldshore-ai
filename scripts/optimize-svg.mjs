import fs from "node:fs";
import { optimize } from "svgo";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("Usage: node scripts/optimize-svg.mjs <file...>");
  process.exit(1);
}

const svgoConfig = {
  multipass: true,
  plugins: [
    "preset-default",
    "removeDimensions",
    "removeXMLNS",
    {
      name: "convertPathData",
      params: { floatPrecision: 2, transformPrecision: 2 }
    },
    { name: "cleanupIds", params: { minify: true } },
    { name: "removeUnknownsAndDefaults" },
    { name: "removeUselessStrokeAndFill" },
    { name: "collapseGroups" }
  ]
};

for (const f of files) {
  const raw = fs.readFileSync(f, "utf8");
  const out = optimize(raw, svgoConfig);
  if (out.error) throw new Error(out.error);

  const outPath = f.replace(/\.svg$/i, ".opt.svg");
  fs.writeFileSync(outPath, out.data, "utf8");
  console.log("Wrote", outPath, `(from ${raw.length} -> ${out.data.length} bytes)`);
}
