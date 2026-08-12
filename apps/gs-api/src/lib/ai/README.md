# Provider-neutral AI gateway

The gateway owns authorization, validation, rate limiting, idempotency, approval,
timeouts, and auditing. Provider adapters only translate model requests. New
tool-using OpenAI flows use `/v1/responses`; do not add Chat Completions flows.

## Credentials and data handling

- Configure `OPENAI_API_KEY` with `wrangler secret put OPENAI_API_KEY --env prod`
  or bind a Cloudflare Secrets Store secret and pass its `get()` handle to
  `OpenAIResponsesProvider`. Never put a key in `wrangler.toml`, source, prompts,
  logs, tool arguments, evaluation fixtures, or browser code.
- Prompts and third-party MCP calls must not contain Cloudflare, GitHub, Google,
  mailbox, CMS, or model-provider credentials. The gateway rejects
  credential-shaped tool arguments. Local tool implementations retrieve only the
  secrets they need from bindings; MCP adapters receive validated arguments only.
- Tool output is untrusted data. It is schema-validated and returned in a
  `function_call_output` envelope. It cannot grant permissions, approve an action,
  register tools, or alter gateway policy.
- OpenAI requests set `store: false`. Avoid regulated, secret, authentication,
  or unnecessary personal data. Apply retention/deletion rules to the configured
  audit sink independently; audit details must remain credential-free.

## Models and fallback

Models are deployment configuration supplied to `AIGateway`; the recommended
starting configuration is a currently supported tool-capable Responses API model.
Pin a dated model snapshot after evaluation rather than assuming a mutable alias.
Fallback is opt-in, occurs only when the initial provider request throws, and uses
the configured fallback model once. Tool errors and policy denials never trigger a
model fallback. Both model names must pass the same evaluation suite before rollout.

## Tool registration

Every tool requires strict input and output object schemas (`required` plus
`additionalProperties: false`), a timeout, rate limit, and an implementation.
Mutations require `ai.tools.mutate` and their tool-specific permission when set.
High-impact tools additionally require human approval with an approver identity.
MCP is deny-by-default: add reviewed server/tool pairs to `ALLOWED_MCP_SERVERS`.
The registry refuses an MCP tool outside that exact allowlist.

Production adapters should back rate limits and idempotency with Durable Objects or
KV and write audit records to the canonical audit store. Do not use process memory
for these controls in a distributed Worker.

## Evaluation fixtures and rollout

Keep synthetic, credential-free fixtures beside tests. At minimum cover valid
read-only execution, unknown/additional fields, invalid output, mutation without
permission, high-impact work without approval, timeout, rate exhaustion,
idempotent replay, unknown MCP server/tool, prompt-injection text in tool output,
and primary-model fallback.

Roll out behind a route/tenant allowlist: internal test, small canary, then gradual
traffic increases. Advance only with zero authorization/secret leaks, expected
denial coverage, no duplicate mutations, acceptable task success, latency, error,
and cost thresholds, and complete audit records. Roll back by disabling the route
flag or reverting to the last evaluated model/configuration if any secret exposure,
unauthorized or duplicate mutation, audit gap, material quality regression, or
budget/latency/error threshold breach occurs. Revoke exposed credentials and retain
audit evidence; model fallback is not an incident rollback mechanism.
