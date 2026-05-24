import type { ControlEnv } from "./types";

export const sync = async (_env: ControlEnv) => {
  return { status: "dns synced", ok: true };
};
