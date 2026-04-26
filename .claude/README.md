# .claude/

Claude Code project configuration for goldshore.ai.

## settings.local.json

Local credentials file (gitignored). Copy the template and fill in your values:

```json
{
  "env": {
    "CF_API_TOKEN": "<your Cloudflare API token>",
    "CF_ACCOUNT_ID": "<your Cloudflare account ID>",
    "CF_ZONE_ID": "<your goldshore.ai zone ID>"
  }
}
```

Find these values in the Cloudflare dashboard:
- **CF_API_TOKEN** — My Profile → API Tokens
- **CF_ACCOUNT_ID** — Any zone page → right sidebar
- **CF_ZONE_ID** — goldshore.ai zone → Overview → right sidebar
