# DNS & Email Routing Runbook

1. DNS
   - Read `cloudflare.dns.records` from desired-state.
   - Compare with zone records on Cloudflare.
   - Propose:
     - "Create record"
     - "Update record"
     - "Delete record" (requires explicit confirmation)
   - Use proxied = true for app-facing hostnames, proxied = false for raw tests.

2. Email Routing
   - Use `email.routing` from desired-state.
   - If catch_all.enabled is true:
     - Configure Cloudflare Email Routing catch-all to destination.
   - For individual addresses, ensure `address → destination` pairs exist.

3. Safety
   - Do not alter MX records unrelated to Cloudflare Email Routing.
   - Do not remove existing MX for production mail without an explicit
     "migrate email" instruction.
