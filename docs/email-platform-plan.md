# GoldShore email platform plan

## Transactional delivery: Cloudflare Email Service

`gs-api` is the only sender. Requests enqueue into `MAIL_JOBS_QUEUE`; the queue consumer calls the native `EMAIL` binding and records operational metadata in `mail_jobs`. Message bodies and recipient addresses are not persisted in that table.

Approved transactional uses:

- workspace invitations and account activation codes;
- password, identity, permission, billing, and security alerts;
- purchase and subscription receipts;
- contact-form acknowledgements and internal submission notifications.

Marketing, affiliate broadcasts, prospecting, retargeting, and newsletters must not use Cloudflare Email Service.

## Marketing delivery: Brevo

Brevo is a separate consent-based channel. Use a dedicated API key stored as a Cloudflare secret and a dedicated sending subdomain so marketing reputation cannot impair transactional delivery.

### Contact fields

| Field | Type | Purpose |
| --- | --- | --- |
| `FIRSTNAME`, `LASTNAME` | text | Personalization |
| `COMPANY`, `JOB_TITLE` | text | Account context |
| `PHONE` | text | Optional sales contact; never required for email |
| `COUNTRY`, `TIMEZONE`, `LANGUAGE` | text | Localization and send time |
| `LIFECYCLE_STAGE` | category | subscriber, lead, MQL, SQL, customer, partner |
| `LEAD_SOURCE`, `UTM_SOURCE`, `UTM_MEDIUM`, `UTM_CAMPAIGN` | text | First-touch attribution |
| `INTERESTS` | multi-category | design, development, marketing, SaaS, publishing, AI |
| `CONSENT_EMAIL`, `CONSENT_ADS`, `CONSENT_AFFILIATE` | boolean | Purpose-specific permission |
| `CONSENT_AT`, `CONSENT_SOURCE`, `CONSENT_VERSION` | text/date | Consent evidence |
| `CUSTOMER_VALUE`, `LAST_PURCHASE_AT` | number/date | Customer segmentation |
| `GS_CONTACT_ID` | text | Pseudonymous GoldShore record link; not a secret |

Do not upload passwords, activation tokens, Cloudflare Access claims, payment card data, private messages, or sensitive profiling data.

### Roles and permissions

- Owner: billing, domains, API keys, and administrator access.
- Technical administrator: API/webhook configuration and template integration; no campaign approval by default.
- Marketing manager: campaigns, lists, segments, and automation.
- Content editor: templates and drafts only.
- Analyst: aggregate reports and attribution; export disabled unless required.

Require MFA, keep at least two owners, issue separate API keys per environment, rotate keys, and enable only the scopes needed by each integration.

### Lifecycle channels

1. Lead capture: double opt-in forms with explicit purpose and source metadata.
2. Nurture: educational sequences selected by stated interests, not inferred sensitive traits.
3. Sales: lead scoring and human follow-up after an engagement threshold.
4. Advertising: sync only consented audiences; use hashed identifiers and retention limits.
5. Affiliate and partnerships: separately disclosed consent, partner identifier, and suppression enforcement.
6. Purchases: transactional receipts remain on Cloudflare; consented cross-sell and replenishment journeys use Brevo.

Every marketing message must include an unsubscribe mechanism and GoldShore business identity. Suppression and consent changes must synchronize back to GoldShore before any future send.
