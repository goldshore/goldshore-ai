# Open-source candidate survey

> **Note:** Network access to GitHub APIs is blocked in this environment, so activity metrics and security posture checks could not be verified live. The entries below are based on commonly known project details and should be confirmed directly in each repository (license files, release tags, security policies, and advisory databases) before adoption.

## eBay listing automation

| Candidate | Repo | License | Activity | Security posture | API compatibility |
| --- | --- | --- | --- | --- | --- |
| ebaysdk-python | https://github.com/timotheus/ebaysdk-python | MIT (verify) | Appears lower-velocity; confirm last release/commit | No known security policy; verify SECURITY.md/advisories | Supports eBay Trading API for listing/inventory flows; suitable for automation scripts |
| ebay-api (Node) | https://github.com/davidjbradshaw/ebay-api | MIT (verify) | Moderate activity historically; verify recency | No known formal security policy; check advisories | Node.js wrapper for eBay REST/Trading endpoints for listing workflows |
| eBay OAuth Node client | https://github.com/eBay/ebay-oauth-nodejs-client | Apache-2.0 (verify) | Likely maintained by eBay; verify recency | Official org; check SECURITY.md + advisories | Auth client needed for modern eBay API access; pair with listing SDKs |

## PayPal + TurboTax + USA.gov job workflow

| Candidate | Repo | License | Activity | Security posture | API compatibility |
| --- | --- | --- | --- | --- | --- |
| PayPal Checkout Python SDK | https://github.com/paypal/Checkout-Python-SDK | Apache-2.0 (verify) | Likely maintained; verify latest release | PayPal org; check SECURITY.md/advisories | Direct PayPal REST integration for payments and order capture |
| Intuit OAuth sample (TurboTax/Intuit) | https://github.com/IntuitDeveloper/oauth2-nodejs | Apache-2.0 or MIT (verify) | Varies; confirm recency | Intuit org; check security policy | Provides OAuth flows used across Intuit products; TurboTax APIs are limited/public docs required |
| Apache Airflow (workflow orchestration) | https://github.com/apache/airflow | Apache-2.0 | Active (Apache project) | Security policy + advisories (Apache) | Orchestrate PayPal API calls + USAJOBS data pulls + Intuit OAuth workflows via HTTP operators |
| Node-RED (workflow automation) | https://github.com/node-red/node-red | Apache-2.0 | Active | Security policy in IBM org; verify | Low-code HTTP nodes for PayPal/USAJOBS/Intuit endpoints; good for quick integrations |

## SSO with Google/Apple/GitHub/Twilio

| Candidate | Repo | License | Activity | Security posture | API compatibility |
| --- | --- | --- | --- | --- | --- |
| Keycloak | https://github.com/keycloak/keycloak | Apache-2.0 | Active | Strong security posture; advisories + policy | Supports OIDC/SAML with social IdPs (Google, GitHub, Apple). Twilio can be added via custom identity brokering or SMS-based flows |
| authentik | https://github.com/goauthentik/authentik | MIT (verify) | Active | Security policy present; verify advisories | OIDC/SAML + social login support; extensible to Twilio with custom provider |
| Ory Kratos | https://github.com/ory/kratos | Apache-2.0 (verify) | Active | Security policy + advisories | Identity system with OIDC/third-party integration via Ory Hydra/CLI; supports social login flows |

## PII scrubbers for web/git

| Candidate | Repo | License | Activity | Security posture | API compatibility |
| --- | --- | --- | --- | --- | --- |
| Gitleaks | https://github.com/gitleaks/gitleaks | MIT | Active | Security policy + advisories | Git scanning for secrets/PII in repos and CI pipelines |
| TruffleHog | https://github.com/trufflesecurity/trufflehog | AGPL-3.0 (verify) | Active | Security policy + advisories | Deep secret scanning for git and file systems; integrates with CI |
| Git-secrets | https://github.com/awslabs/git-secrets | MIT (verify) | Moderate | AWS security practices; verify policy | Prevents committing secrets/PII via git hooks |
| Microsoft Presidio | https://github.com/microsoft/presidio | MIT (verify) | Active | Security policy + advisories | NLP-based PII detection/redaction for text and logs |

## Business opportunity discovery tools

| Candidate | Repo | License | Activity | Security posture | API compatibility |
| --- | --- | --- | --- | --- | --- |
| OpenBB Terminal | https://github.com/OpenBB-finance/OpenBBTerminal | MIT (verify) | Active | Security policy; verify | Aggregates market/financial data; useful for market research signals |
| Apache Superset | https://github.com/apache/superset | Apache-2.0 | Active | Apache security policy/advisories | BI dashboards for market data analysis and opportunity tracking |
| Metabase | https://github.com/metabase/metabase | MIT (verify) | Active | Security policy; verify | Business analytics over CRM/lead data for opportunity insights |

## Monetization & client intake pipelines

| Candidate | Repo | License | Activity | Security posture | API compatibility |
| --- | --- | --- | --- | --- | --- |
| Cal.com | https://github.com/calcom/cal.com | AGPL-3.0 (verify) | Active | Security policy; verify | Scheduling + routing for client intake pipelines; integrates with webhooks |
| Formbricks | https://github.com/formbricks/formbricks | AGPL-3.0 (verify) | Active | Security policy; verify | Open-source forms/surveys for lead capture and intake |
| Chatwoot | https://github.com/chatwoot/chatwoot | MIT | Active | Security policy + advisories | Customer chat + intake; webhook integrations for CRM/monetization flows |
| Medusa | https://github.com/medusajs/medusa | MIT (verify) | Active | Security policy; verify | Modular e-commerce stack for monetization and client checkout flows |

## Recommendations for follow-up verification

1. **License verification:** Confirm `LICENSE` or SPDX metadata for each repo before adoption.
2. **Activity metrics:** Review last commit dates, open issues, and release cadence to ensure the project is maintained.
3. **Security posture:** Check for `SECURITY.md`, published advisories, and dependency scanning status.
4. **API compatibility:** Validate current API versions (eBay Trading vs. REST, PayPal v2, Intuit OAuth scopes, USAJOBS API requirements) with official docs.
