# Gateway Dispatch Token Retirement

The gateway deployment dispatch is retired. Do not rotate or recreate
`GS_DISPATCH_TOKEN`, and do not restore the archived verification workflow.

Remove the secret and any caller workflow from `marzton/goldshore-gateway`, then
revoke the underlying GitHub credential. See
[`docs/security/GATEWAY_DISPATCH_TOKEN_ROTATION.md`](../../security/GATEWAY_DISPATCH_TOKEN_ROTATION.md)
for the retirement rationale and the requirements for independently owned
external deployments.
