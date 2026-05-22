// infra/cf/client.ts
import type FormData from "form-data";

export type CF = {
  pages: {
    deployments(project: string): Promise<any[]>;
    triggerBuild(project: string): Promise<{ id: string }>;
    getDeployment(project: string, id: string): Promise<any>;
    cancelDeployment(project: string, id: string): Promise<void>;
  };
  workers: {
    listBindings(script: string): Promise<any[]>;
    deploy(script: string, formData: FormData): Promise<{ id: string }>;
    versions(script: string): Promise<any[]>;
    rollback(script: string, versionId: string): Promise<void>;
  };
  dns: {
    list(): Promise<any[]>;
  }
};

const API = "https://api.cloudflare.com/client/v4";
const tok = process.env.CF_API_TOKEN!;
const acc = process.env.CF_ACCOUNT_ID!;
const zone = process.env.CF_ZONE_ID!;

function isStream(body: any): boolean {
  return body && typeof body.pipe === 'function';
}

async function cfFetch<T>(path: string, init: RequestInit = {}, tries = 5, wait = 250): Promise<T> {
  // If the body is a stream (e.g. FormData), we cannot retry because the stream might be consumed.
  // Unless we buffer it, but FormData can be large.
  // For now, disable retry if body is present and not a string/buffer (simple check).
  // Better check: if it's FormData from 'form-data' package, it is a stream.

  const canRetry = tries > 0 && !isStream(init.body);

  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${tok}`,
      ...(init.headers || {}),
    }
  });

  if (res.status === 429 && canRetry) {
    const retry = Number(res.headers.get("Retry-After")) * 1000 || wait;
    await new Promise(r => setTimeout(r, retry));
    return cfFetch<T>(path, init, tries - 1, wait * 2);
  }
  if (!res.ok) throw new Error(`CF ${path} ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.result as T;
}

export const cf: CF = {
  pages: {
    deployments: (project) => cfFetch(`/accounts/${acc}/pages/projects/${project}/deployments?per_page=20`),
    triggerBuild: (project) => cfFetch(`/accounts/${acc}/pages/projects/${project}/deployments`, { method: "POST" }),
    getDeployment: (project, id) => cfFetch(`/accounts/${acc}/pages/projects/${project}/deployments/${id}`),
    cancelDeployment: (project, id) => cfFetch(`/accounts/${acc}/pages/projects/${project}/deployments/${id}`, { method: "DELETE" }),
  },
  workers: {
    listBindings: (script) => cfFetch(`/accounts/${acc}/workers/scripts/${script}/bindings`),
    deploy: (script, formData) => {
       // FormData from 'form-data' package needs getHeaders() mixed in.
       // The type in 'deploy' signature says FormData, assuming it's the node 'form-data' package because we are in a node script.
       const headers = (formData as any).getHeaders ? (formData as any).getHeaders() : {};
       return cfFetch(`/accounts/${acc}/workers/scripts/${script}`, {
         method: "PUT",
         body: formData as any,
         headers
       });
    },
    versions: (script) => cfFetch(`/accounts/${acc}/workers/scripts/${script}/versions?per_page=20`),
    rollback: (script, versionId) => cfFetch(`/accounts/${acc}/workers/scripts/${script}/versions/${versionId}/rollback`, { method: "POST" }),
  },
  dns: {
    list: () => cfFetch(`/zones/${zone}/dns_records?per_page=200`)
  }
};
