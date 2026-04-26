# apps/web compatibility shim

This directory exists only to support external build systems that still point Cloudflare Pages at the legacy `apps/web` root.

Canonical web app source remains in `apps/gs-web`.

The local build command delegates to `apps/gs-web`, then copies the generated `dist/` output into this directory so legacy Pages settings can continue to build until the dashboard root directory is updated to `apps/gs-web`.
