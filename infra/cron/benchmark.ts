import { performance } from "node:perf_hooks";

// Mocks
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function getPagesProjectBuildStatus(_project: string) {
  await delay(100);
  return "success";
}

async function getDNSRecords() {
  await delay(100);
  return [];
}

async function getWorkerBindings(_script: string) {
  await delay(100);
  return ["binding1"];
}

async function openOpsIssue() {
  await delay(100);
}

// Config mock
const cfg = {
  cloudflare: {
    checks: Array.from({ length: 20 }, () => ({ type: "pages_build_status", project: "gs-web" })),
  },
  github: { org: "goldshore" },
  ai_agent: { triage_labels: [] }
};

// Original sequential function
async function checkCloudflareSequential() {
  for (const check of (cfg.cloudflare.checks as any[])) {
    if (check.type === "pages_build_status") {
      const status = await getPagesProjectBuildStatus(check.project);
      if (!["success", "completed"].includes(status)) {
        await openOpsIssue();
      }
    }
    if (check.type === "dns_records") {
      await getDNSRecords();
      // Mock logic
    }
    if (check.type === "worker_health") {
      await getWorkerBindings(check.script);
      // Mock logic
    }
  }
}

async function checkCloudflareConcurrent() {
  // Limit concurrent checks to avoid overwhelming external services during the benchmark.
  const MAX_CONCURRENT_CHECKS = 6;
  const maxConcurrent = MAX_CONCURRENT_CHECKS;
  const checks = cfg.cloudflare.checks as any[];
  const executing = new Set<Promise<void>>();

  for (const check of checks) {
    const p = Promise.resolve().then(async () => {
      try {
        if (check.type === "pages_build_status") {
          const status = await getPagesProjectBuildStatus(check.project);
          if (!["success", "completed"].includes(status)) {
            await openOpsIssue();
          }
        } else if (check.type === "dns_records") {
          await getDNSRecords();
          // Mock logic
        } else if (check.type === "worker_health") {
          await getWorkerBindings(check.script);
          // Mock logic
        }
      } catch (err: any) {
        console.error(`Error processing check ${check.type}:`, err);
      }
    });

    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean).catch(clean);

    if (executing.size >= maxConcurrent) {
      await Promise.race(executing);
    }
  }

  // Wait for the remaining checks to complete
  await Promise.all(executing);
}

async function runBenchmark() {
  console.log("Starting Sequential Benchmark...");
  const startSeq = performance.now();
  await checkCloudflareSequential();
  const endSeq = performance.now();
  const seqTime = endSeq - startSeq;
  console.log(`Sequential execution took: ${seqTime.toFixed(2)}ms`);

  console.log("Starting Concurrent Benchmark...");
  const startConc = performance.now();
  await checkCloudflareConcurrent();
  const endConc = performance.now();
  const concTime = endConc - startConc;
  console.log(`Concurrent execution took: ${concTime.toFixed(2)}ms`);

  console.log(`Speed improvement: ${(seqTime / concTime).toFixed(2)}x faster`);
}

runBenchmark().catch(console.error);
