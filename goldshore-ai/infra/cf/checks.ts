// infra/cf/checks.ts
import { cf } from "./client";

export async function latestPagesStatus(project: string): Promise<"success"|"failed"|"building"|"unknown"> {
  const ds = await cf.pages.deployments(project);
  const s = ds[0]?.latest_stage?.status ?? "unknown";
  return s;
}

export async function workerBindingsOk(script: string): Promise<boolean> {
  const b = await cf.workers.listBindings(script);
  return Array.isArray(b) && b.length > 0;
}
