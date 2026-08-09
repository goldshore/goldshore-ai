# Legacy Content, Mail, and Contact Architecture

Status: proposed and partially audited on 2026-07-22. Tracking issue: #5883.

## Objectives

- Recover useful media, logos, page copy, and structured content without restoring WordPress.
- Preserve raw evidence privately and publish only reviewed, deduplicated assets.
- Provide group mailboxes with IMAP/SMTP client profiles where a real mailbox is required.
- Store contact lists with source, consent, suppression, and import lineage.
- Keep all runtime behavior in `apps/gs-api` and all review UI in `apps/gs-web`.

## Audited Sources

### HostGator

- SSH and cPanel UAPI are available for account `trebweb`.
- Recoverable upload trees exist for ArmsWay, GearSwipe, Tangent Machine, GoldShore,
  and other installations.
- Recoverable SQL exports include ArmsWay, GearSwipe, Tangent, SoleFood NY, GoldShore,
  and rmarston datasets.
- A 2.68 GB full-account archive exists at the account root.
- Anonymous FTP remains enabled. Disable it after recovery and verification.
- Historical database users are shared across several databases. Treat every dump as
  untrusted input and never attach an old database directly to production.

### Google Drive

Drive discovery found:

- ArmsWay project folders, static HTML pages, domain records, and patent material.
- GearSwipe project folders, pitch material, DNS records, and plugin/site archives.
- Tangent Machine project and web-content folders.
- SoleFood NY themes, newsletter records, site records, and `SFNY_LOGO.pdf`.
- Multiple logo folders and duplicated web exports.
- Candidate investor, mailing, DNM, and contact files.

Candidate contact files are evidence only. Do not import or message contacts until the
source and consent basis are reviewed. A DNM/suppression source always wins over a list
membership.

## Target Architecture

```text
HostGator SSH/UAPI ----> local encrypted staging ----> gs-legacy-archive (private R2)
Google Drive metadata -/            |                         |
                                      +--> checksum manifest   +--> gs-api review queue
                                                                  |
                                                                  +--> gs-assets (curated media)
                                                                  +--> PLATFORM_DB catalog
                                                                  +--> CONTACTS_DB contacts

cPanel mailbox ---- IMAP/SMTP ---- desktop/mobile mail client
Cloudflare Email Routing ---------> forwarding or gs-api email() handler
gs-api MAIL_JOBS_QUEUE -----------> transactional outbound provider
```

## Cloudflare Resources

| Resource | Purpose | Access |
| --- | --- | --- |
| `gs-legacy-archive` R2 | Original archives, SQL dumps, Drive exports, manifests | Private; `gs-api` admin routes only |
| `gs-contact-imports` R2 | Temporary encrypted/raw list imports | Private; delete raw imports after 30 days |
| existing `gs-assets` R2 | Reviewed logos, images, and downloadable public media | Read via controlled asset routes |
| `gs_contacts_db` D1 | Contacts, list membership, consent, suppression, import lineage | `gs-api` only |
| `gs-archive-jobs` Queue | Extraction, hashing, metadata, thumbnail, and OCR jobs | Producer/consumer in `gs-api` |
| existing dead-letter queue | Failed archive/import jobs | Operator review |

Do not bind D1 or R2 directly to `gs-web`. Admin pages call protected `gs-api` routes.
Provision preview resources separately; preview must not share contact or raw archive data.

## Archive Object Layout

```text
raw/{source}/{brand}/{capture-date}/{sha256}/{original-name}
manifests/{capture-id}.json
derived/{brand}/{sha256}/metadata.json
derived/{brand}/{sha256}/text.txt
curated/{brand}/{asset-id}/{filename}
```

Every object manifest records source URI/path, capture time, byte length, SHA-256,
media type, brand, review state, and parent archive. Never commit raw files, email
addresses, credentials, database dumps, or Drive exports to GitHub.

## Recovery Pipeline

1. Generate read-only inventories and checksums at the source.
2. Copy only `wp-content/uploads`, selected static HTML, and named SQL dumps into an
   encrypted local staging directory.
3. Scan archives for malware, executable PHP, secrets, and PII before extraction.
4. Upload originals to private R2 with immutable capture IDs.
5. Extract WordPress posts/pages in an isolated container with no network access.
6. Deduplicate media by SHA-256 and perceptual hash; retain the highest-resolution source.
7. Review licenses, ownership, content, and brand assignment.
8. Promote approved assets to `gs-assets`; publish only through `gs-web`/`gs-api`.
9. Perform a sampled restore test before deleting any HostGator source.

## Contact Governance

- Store normalized email addresses in D1; keep raw import files only in restricted R2.
- Record source file, source brand, acquisition date, consent basis, and importer.
- Maintain global and brand-specific suppressions.
- Never infer marketing consent from an address appearing in an old database or PDF.
- Import DNM, unsubscribe, bounce, and complaint records before active memberships.
- Encrypt sensitive profile fields at the application layer with a Secrets Store key.
- Audit every import, merge, export, and send campaign.

## Mail Model

Use a real cPanel mailbox when staff need IMAP/SMTP history and a downloadable client
profile. Use Cloudflare Email Routing for forwarding aliases and Email Workers for
programmatic inbound processing. Use the existing `gs-api` mail queues for transactional
outbound mail.

Recommended functional identities, subject to domain and owner approval:

| Address | Type | Purpose |
| --- | --- | --- |
| `ops@...` | mailbox | Infrastructure notices and operator correspondence |
| `archive@...` | mailbox | Recovery receipts and archive reports |
| `support@...` | mailbox or routed alias | Customer support |
| `legal@...` | mailbox | Contracts, rights, privacy, and takedowns |
| `billing@...` | mailbox | Vendor and payment notices |
| `noreply@...` | send-only identity | Automated transactional messages |

Do not create catch-all mailboxes. Use unique generated passwords, MFA on cPanel, bounded
quotas, DKIM/SPF/DMARC, and separate credentials per mailbox. Profiles contain server and
username settings only; passwords are entered into the client interactively.

### Approved temporary mailbox plan

The temporary mailbox provider is HostGator cPanel for `rmarston.com`.

- Keep real 2 GB mailboxes: `ops@rmarston.com`, `support@rmarston.com`, and
  `newsletter@rmarston.com`.
- Route `archive@goldshore.ai`, `legal@goldshore.ai`, and `billing@goldshore.ai`
  to `ops@rmarston.com`; these do not need separate inboxes yet.
- Route `ops@goldshore.ai`, `support@goldshore.ai`, and
  `newsletter@goldshore.ai` to their matching `rmarston.com` mailboxes.
- Keep `noreply@goldshore.ai` send-only and never monitor it as a support address.
- Keep Cloudflare catch-all routing disabled.

Password-free Apple and Thunderbird profiles are generated by
`scripts/hostgator/New-MailClientProfiles.ps1`. Passwords are stored separately and must
never be embedded in a profile or committed.

## GitHub Controls

- Keep infrastructure manifests, schemas, scripts, and checksum-only inventory reports.
- Use OIDC or scoped environment secrets for Cloudflare deployment.
- Protect the production environment and require review for archive/contact migrations.
- Add secret scanning and a CI rule rejecting `.sql`, mailbox files, contact exports,
  `.env`, cPanel profiles containing passwords, and raw archive formats.
- Store generated inventories as short-lived encrypted workflow artifacts, not releases.

## Provisioning Gates

Before creating resources or mailboxes, confirm:

1. Mail domain and provider of record (`rmarston.com` is currently hosted at cPanel;
   `goldshore.ai` requires a separate mailbox provider or forwarding-only design).
2. Final functional addresses, owners, quotas, retention, and forwarding destinations.
3. Whether contact processing has a documented consent/legal basis.
4. R2 retention and expected archive size after deduplication.
5. Which legacy brands remain active and which are archive-only.
