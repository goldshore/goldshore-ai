import type { ControlEnv } from "./types";

export const deploy = async (_env: ControlEnv) => {
  return { status: "pages deployed", ok: true };
};
