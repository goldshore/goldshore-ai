# Queue Contract Matrix (Wrangler Source of Truth)

This matrix is generated from the Wrangler manifests in `apps/*/wrangler.toml` and is the source of truth for queue producer/consumer ownership.

| Queue name                            | Producer worker                     | Consumer worker | Environment       |
| ------------------------------------- | ----------------------------------- | --------------- | ----------------- |
| `gs-platform-checkout-events-dev`     | `gs-gateway`                        | `gs-mail`       | `dev`             |
| `gs-platform-contact-events-dev`      | `gs-gateway`                        | `gs-mail`       | `dev`             |
| `gs-platform-checkout-events-preview` | `gs-gateway`                        | `gs-mail`       | `preview`         |
| `gs-platform-contact-events-preview`  | `gs-gateway`                        | `gs-mail`       | `preview`         |
| `gs-platform-checkout-events-prod`    | `gs-gateway`                        | `gs-mail`       | `prod`            |
| `gs-platform-contact-events-prod`     | `gs-gateway`                        | `gs-mail`       | `prod`            |
| `goldshore-jobs`                      | _not declared in current manifests_ | `gs-agent`      | `default`, `prod` |

## Notes

- `gs-platform` is deployed from `apps/gs-gateway`; therefore checkout/contact producer queues are declared in `apps/gs-gateway/wrangler.toml`.
- `gs-mail` consumes the exact checkout/contact queue identifiers emitted by `gs-platform` in each environment (`dev`, `preview`, `prod`).
- `goldshore-jobs` is currently consumer-only in this repository and should either gain an explicit producer declaration or be removed from `gs-agent` when unused.
- Live Cloudflare audit on 2026-07-21: `goldshore-jobs` and `gs-events` are worker-consumed by `gs-mail`, and `gs-mail-jobs` is an HTTP pull consumer. `gs-api` intentionally declares producer bindings only for these queues until consumer ownership is migrated.
