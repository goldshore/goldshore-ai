# apps/admin compatibility shim

This directory exists only to support external build systems that still point Cloudflare Pages at the legacy `apps/admin` root.

Canonical admin app source remains in `apps/gs-admin`.

The local build command delegates to `apps/gs-admin`, then copies the generated `dist/` output into this directory so legacy Pages settings can continue to build until the dashboard root directory is updated to `apps/gs-admin`.
