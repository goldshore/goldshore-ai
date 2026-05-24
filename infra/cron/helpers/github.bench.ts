// infra/cron/helpers/github.bench.ts
process.env.GH_TOKEN = "dummy-token";
import { findOpenConflicts, gh } from "./github.ts";

async function benchmark() {
  const numPRs = 10;
  const latency = 50; // ms

  // Mock list
  (gh.rest.pulls.list as any) = async () => {
    await new Promise(r => setTimeout(r, latency));
    return {
      data: Array.from({ length: numPRs }, (_, i) => ({ number: i }))
    };
  };

  // Mock get
  (gh.rest.pulls.get as any) = async ({ pull_number }: { pull_number: number }) => {
    await new Promise(r => setTimeout(r, latency));
    return {
      data: { mergeable_state: pull_number % 2 === 0 ? "dirty" : "clean" }
    };
  };

  console.log(`Benchmarking findOpenConflicts with ${numPRs} PRs and ${latency}ms latency...`);

  const start = Date.now();
  const results = await findOpenConflicts("owner", "repo");
  const end = Date.now();

  console.log(`Results count: ${results.length}`);
  console.log(`Time taken: ${end - start}ms`);

  // Theoretical sequential time: latency + (numPRs * latency)
  // Theoretical parallel time: latency + latency (if all concurrent)
  const expectedSequential = latency + (numPRs * latency);
  console.log(`Expected sequential time: ~${expectedSequential}ms`);
}

benchmark().catch(err => {
  console.error(err);
  process.exit(1);
});
