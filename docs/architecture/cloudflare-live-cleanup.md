# Cloudflare live cleanup

The desired UI owner is one `gs-web-prod` Worker-with-Assets release:

| Host | Owner |
|---|---|
| `goldshore.ai` | `gs-web-prod` |
| `goldshore.org` | `gs-web-prod` |
| `admin.goldshore.ai` | `gs-web-prod` |
| `admin.goldshore.org` | `gs-web-prod` |

Before removing legacy Cloudflare resources, verify live DNS, routes, Access
policies, and deployed responses. Remove a legacy static project or old Worker
only after proving that none of these hosts or integrations still depend on it.
Do not create a parallel Pages deployment during cleanup.
