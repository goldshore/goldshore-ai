import { performance } from "perf_hooks";

const NUM_DNS_RECORDS = 10000;
const NUM_REQUIRED = 1000;

const dns = Array.from({ length: NUM_DNS_RECORDS }, (_, i) => ({
  name: `record${i}.goldshore.ai`,
  type: i % 2 === 0 ? "CNAME" : "TXT",
  content: `content${i}`
}));

const required = Array.from({ length: NUM_REQUIRED }, (_, i) => ({
  name: `record${i * 10}.goldshore.ai`, // some exist
  type: (i * 10) % 2 === 0 ? "CNAME" : "TXT",
  contains: `content${i * 10}`
}));

function baseline() {
  let hits = 0;
  for (const req of required) {
    const hit = (dns as any[]).find((d: any) => d.name === req.name && d.type === req.type && (req.contains ? (String(d.content || "").includes(req.contains)) : true));
    if (hit) hits++;
  }
  return hits;
}

function optimized() {
  let hits = 0;
  const dnsIndex = new Map<string, any[]>();
  for (const d of dns as any[]) {
    const key = `${d.name}|${d.type}`;
    if (!dnsIndex.has(key)) dnsIndex.set(key, []);
    dnsIndex.get(key)!.push(d);
  }
  for (const req of required) {
    const key = `${req.name}|${req.type}`;
    const records = dnsIndex.get(key) || [];
    const hit = records.find((d: any) => (req.contains ? (String(d.content || "").includes(req.contains)) : true));
    if (hit) hits++;
  }
  return hits;
}

const t0 = performance.now();
baseline();
const t1 = performance.now();
console.log(`Baseline: ${t1 - t0}ms`);

const t2 = performance.now();
optimized();
const t3 = performance.now();
console.log(`Optimized: ${t3 - t2}ms`);
