# Cloudflare KV Secret Inventory

Merge Strategy: Merge Commit

Generated: 2026-07-14T14:52:51.588Z
Account: f77de112d2019e5456a3198a8bb50bd2
Auth source names: runtime:CLOUDFLARE_SYNC_AUTH_TOKEN, runtime:CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN, runtime:CLOUDFLARE_API_TOKEN

No KV plaintext values are included in this report.
Fingerprints are short SHA-256 prefixes plus byte lengths for reuse comparison only.

## Summary

- Namespaces: 31
- Total keys: 9
- Canonical exact keys: 0
- Canonical normalized aliases: 0
- Secret-like unmapped keys: 1
- Manifest KV fallback namespaces present: 4

## Jules Review Ping

@Jules-Bot [review-request]

Please review this sanitized Cloudflare KV namespace/key inventory against `infra/secrets/secret-sync.manifest.yaml`. Focus on which KV keys should be reused as canonical source values, renamed into canonical names, migrated out of KV into Worker/GitHub secrets, or left as runtime cache/session data.

## Namespace Inventory

| Namespace | ID | Role | Keys | Canonical | Alias | Secret-like unmapped |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| `BANPROOF-ME` | `714ee6be6df54291a4a4ade053e9f9ae` | unclassified | 0 | 0 | 0 | 0 |
| `banproof-waitlist` | `eea96e387176489db416472c1d28af2f` | unclassified | 0 | 0 | 0 | 0 |
| `GATEWAY_KV` | `17840f9b6ac64cb1a51aeff085efe24c` | unclassified | 0 | 0 | 0 | 0 |
| `GOLDSHORE-ADMIN` | `d02c0c7951a244a7987e23d8af16b7b2` | unclassified | 0 | 0 | 0 | 0 |
| `GOLDSHORE-AI` | `5f13370575784c9dacff522121104cb3` | manifest-kv-fallback:GOLDSHORE_AI | 8 | 0 | 0 | 1 |
| `GOLDSHORE-API` | `9cc2209906a94851b704be57543987a9` | manifest-kv-fallback:GOLDSHORE_API | 0 | 0 | 0 | 0 |
| `GOLDSHORE-ORG` | `a59a5e2f446348629f59fb21ea69d795` | unclassified | 0 | 0 | 0 | 0 |
| `goldshore-production-GOLDSHORE_KV` | `f18aa1552b6b4239af9ae7486766f502` | production | 0 | 0 | 0 | 0 |
| `goldshore-remote-GOLDSHORE_KV` | `0ea0d244a69f4bb48c38009418498ca7` | unclassified | 0 | 0 | 0 | 0 |
| `goldshore-staging-GOLDSHORE_KV` | `a836649d51354698bf589db04885e4a6` | preview-or-staging | 0 | 0 | 0 | 0 |
| `GS_ADMIN_KV_PREVIEW` | `1f71a79b34db4090824954634dbd78c3` | preview-or-staging | 0 | 0 | 0 | 0 |
| `GS_AGENT_KV` | `25a1eeba1de14e06af18c45b1b2c9743` | manifest-kv-fallback:GS_AGENT_KV | 0 | 0 | 0 | 0 |
| `GS_AI_CACHE` | `a02882aa2e2248158505d3a0aac8e9e2` | runtime-noncanonical | 0 | 0 | 0 | 0 |
| `GS_API_KV` | `e0b8b807191346c3b0afc25fe716d2cd` | unclassified | 0 | 0 | 0 | 0 |
| `GS_API_KV_PREVIEW` | `d4d20cee39094b999dea3f7e5f4c533a` | preview-or-staging | 0 | 0 | 0 | 0 |
| `GS_API_KV_PROD` | `9f2af03810364cbc847b16a03e6c5f35` | production | 0 | 0 | 0 | 0 |
| `GS_API_KV_PRV` | `20d2c096b673433597d084a562993021` | preview-or-staging | 0 | 0 | 0 | 0 |
| `GS_CONFIG` | `68f52b467dc0413991b2195ef9081cae` | manifest-kv-fallback:GS_CONFIG | 0 | 0 | 0 | 0 |
| `GS_CONFIG_PREVIEW` | `dddc8b83775c41e58208bf8de87b7052` | preview-or-staging | 0 | 0 | 0 | 0 |
| `GS_CONTROL_LOGS` | `a52e94cb331c4e3db08f2aa507e6df09` | runtime-noncanonical | 0 | 0 | 0 | 0 |
| `GS_CONTROL_LOGS_PREVIEW` | `09e43cb8bd4749fdaaed0dc9d4ff2284` | preview-or-staging | 0 | 0 | 0 | 0 |
| `GS_TRADING_KV` | `9b3314c3b7af40a284a8c9b6e2990709` | unclassified | 0 | 0 | 0 | 0 |
| `GS_TRADING_KV_PREVIEW` | `2c14b79b76e6453ab57c6dde6116a11d` | preview-or-staging | 0 | 0 | 0 | 0 |
| `gs-signals-cache` | `f8cc5b1dd1ec49d7a3f7bf9acc5f2b1d` | runtime-noncanonical | 1 | 0 | 0 | 0 |
| `gs-signals-cache-preview` | `3c7b2eade8d94448a324d7a6fef2dd3d` | preview-or-staging | 0 | 0 | 0 | 0 |
| `gs-web-app-session` | `e9f3d677cf67460e8870c647db43b46b` | runtime-noncanonical | 0 | 0 | 0 | 0 |
| `gs-web-session` | `09ae2ffbffe24e628c9538c8129dfe33` | runtime-noncanonical | 0 | 0 | 0 | 0 |
| `KV_CACHE` | `895b3586e1ce46c5b33f7a2fdbdad314` | runtime-noncanonical | 0 | 0 | 0 | 0 |
| `KV_SESSIONS` | `d0b889d0ba314b42892f5b959356ceda` | runtime-noncanonical | 0 | 0 | 0 | 0 |
| `RMARSTON-COM` | `a854b3393b5c412bb945742ecb3eda1b` | unclassified | 0 | 0 | 0 | 0 |
| `RR_CACHE` | `0b56873b6d7b451f9279481920a15447` | runtime-noncanonical | 0 | 0 | 0 | 0 |

## Secret-Like And Canonical Keys

### GOLDSHORE-AI

| Key | Status | Manifest match | Expiration | Fingerprint |
| --- | --- | --- | --- | --- |
| `AUTH_WHITELIST` | secret-like-unmapped |  |  | len=122, sha256_12=28ab5f4d886a |

## All Non-Empty Namespaces

### GOLDSHORE-AI

| Key | Status | Expiration | Metadata |
| --- | --- | --- | --- |
| `AI_CONFIG` | unmapped |  | no |
| `AUTH_WHITELIST` | secret-like-unmapped |  | no |
| `CORS_ORIGIN` | unmapped |  | no |
| `GATEWAY_KV` | unmapped |  | no |
| `GS_API_DATA` | unmapped |  | no |
| `ROUTING_TABLE` | unmapped |  | no |
| `SERVICE_STATUS` | unmapped |  | no |
| `USER_ROLE:marstonr6@gmail.com` | unmapped |  | no |

### gs-signals-cache

| Key | Status | Expiration | Metadata |
| --- | --- | --- | --- |
| `GOLDSHORE-AI ` | unmapped |  | no |

## Next Decisions

- Prefer canonical names already present in `infra/secrets/secret-sync.manifest.yaml`.
- Treat normalized aliases as rename candidates, not new source-of-truth names.
- Do not migrate cache/session/log namespaces into the secret sync manifest.
- Use fingerprints only to prove two non-plaintext values are identical before reuse.

