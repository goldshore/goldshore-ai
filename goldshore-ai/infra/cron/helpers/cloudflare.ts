// infra/cron/helpers/cloudflare.ts
const CF_API_TOKEN = process.env.CF_API_TOKEN!;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID!;
const CF_ZONE_ID = process.env.CF_ZONE_ID!;

if (!CF_API_TOKEN) throw new Error("Missing CF_API_TOKEN");
if (!CF_ACCOUNT_ID) throw new Error("Missing CF_ACCOUNT_ID");
if (!CF_ZONE_ID) throw new Error("Missing CF_ZONE_ID");

const CF_API = "https://api.cloudflare.com/client/v4";

async function cfFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!res.ok) throw new Error(`Cloudflare API ${path} failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.result as T;
}

export async function getPagesProjectBuildStatus(project: string) {
  type Build = { id: string; deployment_trigger: any; latest_stage: { name: string; status: string } };
  const builds = await cfFetch<Build[]>(`/accounts/${CF_ACCOUNT_ID}/pages/projects/${project}/deployments`);
  return builds[0]?.latest_stage?.status ?? "unknown";
}

export async function getDNSRecords() {
  type Rec = { id: string; name: string; type: string; content: string };
  const records = await cfFetch<Rec[]>(`/zones/${CF_ZONE_ID}/dns_records?per_page=200`);
  return records;
}

export async function getWorkerBindings(script: string) {
  type Binding = { name: string; type: string };
  const bindings = await cfFetch<Binding[]>(`/accounts/${CF_ACCOUNT_ID}/workers/scripts/${script}/bindings`);
  return bindings;
}
