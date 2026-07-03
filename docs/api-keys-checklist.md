# API Keys & Credentials Checklist

All keys go into GitHub Actions Secrets or Cloudflare Worker secrets — never committed to git.

---

## Status legend
- ✅ Confirmed working
- ⚠️ Needs renewal
- ❌ Missing / not yet created
- ⏳ In progress

---

## 1. Cloudflare

| Secret name | Repo | Status | Retrieve from |
|------------|------|--------|---------------|
| `CLOUDFLARE_API_TOKEN` | `goldshore-gateway` | ⚠️ Expired (blocking CI) | [dash.cloudflare.com → My Profile → API Tokens → Create Token](https://dash.cloudflare.com/profile/api-tokens) |
| `CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN` | `goldshore-ai` | ⚠️ Needs renewal | Same as above — use `manage-cf-tokens.yml` workflow |
| `CF_AUTH_EMAIL` | `goldshore-ai` | ✅ | Your Cloudflare account email |
| `CF_AUTH_KEY` | `goldshore-ai` | ❌ Optional | [dash.cloudflare.com → My Profile → API Tokens → Global API Key](https://dash.cloudflare.com/profile/api-tokens) |

**Cloudflare token setup steps:**
1. Go to [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token** → Use template **Edit Cloudflare Workers**
3. Scope to your account and `goldshore.ai` zone
4. Copy the token value (shown once)
5. Add to GitHub: repo → Settings → Secrets → Actions → New secret

---

## 2. Google Cloud / OAuth

All Google APIs share one OAuth 2.0 credential set from the same GCP project.

| Secret name | Where to set | Status | Retrieve from |
|------------|-------------|--------|---------------|
| `GOOGLE_CLIENT_ID` | Cloudflare Worker secrets + GH Actions | ❌ | [console.cloud.google.com → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_CLIENT_SECRET` | Same | ❌ | Same — OAuth 2.0 Client ID download |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | GH Actions (base64 JSON) | ❌ | [console.cloud.google.com → IAM & Admin → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts) |

**OAuth credential setup steps:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → select or create project `goldshore`
2. [Enable APIs](https://console.cloud.google.com/apis/library) (see each section below)
3. [Create credentials](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 Client ID → Web application
4. Add authorized redirect URIs: `https://goldshore.ai/auth/google/callback`, `https://admin.goldshore.ai/auth/callback`
5. Download the JSON → extract `client_id` and `client_secret`

---

## 3. Google Ads API

| Item | Status | Link |
|------|--------|------|
| Developer token | ❌ | [ads.google.com → Tools → API Center](https://ads.google.com/aw/apicenter) |
| API enabled in GCP | ❌ | [Enable Google Ads API](https://console.cloud.google.com/apis/library/googleads.googleapis.com) |
| OAuth consent screen | ❌ | [console.cloud.google.com → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent) |

**Setup steps:**
1. Enable API: [console.cloud.google.com/apis/library/googleads.googleapis.com](https://console.cloud.google.com/apis/library/googleads.googleapis.com)
2. Get developer token: sign into [ads.google.com](https://ads.google.com) → Tools → API Center → copy **Developer token**
3. Store as `GOOGLE_ADS_DEVELOPER_TOKEN` in GitHub Secrets and Cloudflare Worker secrets
4. OAuth flow uses `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` from step 2 above

---

## 4. Google AdSense API

| Item | Status | Link |
|------|--------|------|
| AdSense account linked | ⏳ | [adsense.google.com](https://adsense.google.com) |
| API enabled in GCP | ❌ | [Enable AdSense Management API](https://console.cloud.google.com/apis/library/adsense.googleapis.com) |
| Publisher ID (`pub-XXXXXXX`) | ❌ | [adsense.google.com → Account → Account information](https://adsense.google.com/adsense/u/0/pub-/myads/overview) |

**Setup steps:**
1. Enable: [console.cloud.google.com/apis/library/adsense.googleapis.com](https://console.cloud.google.com/apis/library/adsense.googleapis.com)
2. Note your Publisher ID from AdSense dashboard → Account → Account information
3. Store as `GOOGLE_ADSENSE_PUBLISHER_ID`
4. Uses same OAuth credentials as above

---

## 5. Google Analytics Data API

| Item | Status | Link |
|------|--------|------|
| GA4 property created | ❌ | [analytics.google.com](https://analytics.google.com) |
| API enabled | ❌ | [Enable Analytics Data API](https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com) |
| Measurement ID (`G-XXXXXXX`) | ❌ | GA4 → Admin → Data Streams → Web stream details |
| Property ID (numeric) | ❌ | GA4 → Admin → Property Settings |

**Setup steps:**
1. Enable: [console.cloud.google.com/apis/library/analyticsdata.googleapis.com](https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com)
2. Create GA4 property at [analytics.google.com](https://analytics.google.com) for `goldshore.ai`
3. Add data stream → Web → `https://goldshore.ai`
4. Store `GOOGLE_ANALYTICS_PROPERTY_ID` and `GOOGLE_ANALYTICS_MEASUREMENT_ID`
5. Add the Measurement ID to `apps/gs-web` (Astro config or `<head>`)

---

## 6. Google My Business (Business Profile API)

| Item | Status | Link |
|------|--------|------|
| Business Profile verified | ⏳ | [business.google.com](https://business.google.com) |
| API enabled | ❌ | [Enable Business Profile API](https://console.cloud.google.com/apis/library/mybusinessaccountmanagement.googleapis.com) |
| Location ID | ❌ | Business Profile dashboard → Business info |

**Setup steps:**
1. Enable APIs:
   - [mybusinessaccountmanagement](https://console.cloud.google.com/apis/library/mybusinessaccountmanagement.googleapis.com)
   - [mybusinessbusinessinformation](https://console.cloud.google.com/apis/library/mybusinessbusinessinformation.googleapis.com)
2. Uses same OAuth credentials
3. Requires verification of business — check [business.google.com](https://business.google.com) status

---

## 7. Google Chat

| Item | Status | Link |
|------|--------|------|
| Goldshore dev space created | ❌ | [chat.google.com](https://chat.google.com) |
| CI webhook URL | ❌ | Space → Apps & integrations → Webhooks → Add Webhook |
| Chat API enabled (for bot) | ❌ | [Enable Chat API](https://console.cloud.google.com/apis/library/chat.googleapis.com) |

**Webhook setup steps (quickest — no bot needed):**
1. Open [chat.google.com](https://chat.google.com) → create a Space named `goldshore-ci`
2. Click space name → **Apps & integrations** → **Webhooks** → **Add webhook**
3. Name it `GitHub CI`, copy the webhook URL
4. Add to GitHub Secrets as `GOOGLE_CHAT_WEBHOOK` in **both** `goldshore-ai` and `goldshore-gateway` repos

---

## 8. GitHub

| Item | Status | Link |
|------|--------|------|
| SSH key: Termux | ✅ | [github.com/settings/keys](https://github.com/settings/keys) |
| SSH key: HP Laptop | ❌ | Same — run `scripts/setup-device.sh goldshore-hp` |
| SSH key: iPad Pro | ❌ | Same — see CLAUDE.md iPad section |
| `GITHUB_TOKEN` | ✅ auto | Injected by Actions automatically |

---

## Quick action priority

```
[ ] 1. Renew CLOUDFLARE_API_TOKEN in goldshore-gateway  → unblocks PR #213 CI
[ ] 2. Renew CLOUDFLARE_GOLDSHORE_AI_DEPLOY_TOKEN       → unblocks goldshore-ai deploys  
[ ] 3. Create Google Chat webhook                       → enables CI failure notifications
[ ] 4. Enable Google Ads + AdSense APIs in GCP          → monetization
[ ] 5. Add HP laptop SSH key to GitHub                  → local dev on laptop
[ ] 6. Add iPad Pro SSH key to GitHub                   → local dev on iPad
```
