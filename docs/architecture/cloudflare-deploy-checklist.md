# Cloudflare deploy checklist

## gs-web

- Build `apps/gs-web` with the Astro Cloudflare adapter in server mode.
- Confirm `dist` contains the generated server output and static assets.
- Confirm `src/worker.ts` remains Wrangler's `main` entry point.
- Confirm the `ASSETS` binding points at `./dist`.
- Deploy `env.prod` as the single `gs-web-prod` Worker release.
- Smoke-test `goldshore.ai`, `goldshore.org`, `admin.goldshore.ai`, and
  `admin.goldshore.org`; compare their release/version marker when available.
- Never upload the client asset subtree as a second static project.

## Architecture-change gate

A Pages migration is permitted only as an explicit replacement after every
dynamic web endpoint has moved into `apps/gs-api`. It must not coexist with the
Worker-with-Assets release.
