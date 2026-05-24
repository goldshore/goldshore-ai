import type { ControlEnv } from "./types";

export const reconcile = async (_env: ControlEnv) => {
  return { status: "workers reconciled", ok: true };
};
