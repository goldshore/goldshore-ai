# Cloudflare Access Setup Checklist

**Quick reference for configuring CF Access for admin.goldshore.ai**

---

## Pre-Flight

- [ ] Have Cloudflare dashboard access to account `f77de112d2019e5456a3198a8bb50bd2` (Gold Shore Labs)
- [ ] GitHub OAuth is configured as an identity provider in Zero Trust
- [ ] Marstonr6@gmail.com email is added to GitHub account (for testing)

---

## Configuration

### Step 1: Create/Verify Access Application

**Dashboard:** Cloudflare → Zero Trust → Access → Applications

- [ ] Application name: `admin-production`
- [ ] Type: Self-hosted
- [ ] Audience/Application ID: `c520a7647223b49b20fbe5be240772863eb684b97b57c08955b6104c58170db9`

### Step 2: Add Hostnames

**Dashboard:** Application Settings → Configure hosts

```
admin.goldshore.ai/*
admin.goldshore.org/*
```

- [ ] Both hostnames added

### Step 3: Allow Policy

**Dashboard:** Application → Policies → Add Policy

- [ ] Policy name: `Goldshore Admin Owners`
- [ ] Action: **Allow**
- [ ] Identities: Email
- [ ] Emails:
  - [ ] `marstonr6@gmail.com`
  - [ ] `admin@goldshore.org`
- [ ] Require GitHub OAuth verified email
- [ ] Policy saved

### Step 4: Deny Policy

**Dashboard:** Application → Policies → Add Policy

- [ ] Policy name: `Deny Everyone Else`
- [ ] Action: **Deny**
- [ ] Identities: Everyone
- [ ] Policy saved **AFTER** Allow policy

### Step 5: Dashboard Variables

**Dashboard:** Workers & Pages → gs-web → Production Environment → Settings

- [ ] Variable name: `ADMIN_OWNER_EMAILS`
- [ ] Value: `marstonr6@gmail.com,admin@goldshore.org`
- [ ] Saved (no redeploy needed)

### Step 6: Verify GitHub IdP

**Dashboard:** Zero Trust → Settings → Authentication → GitHub

- [ ] GitHub OAuth configured
- [ ] Client ID set
- [ ] Client Secret set

---

## Testing (Private Browser)

- [ ] **Test 1:** Login as `marstonr6@gmail.com` → Access granted ✅
- [ ] **Test 2:** Login as `admin@goldshore.org` → Access granted ✅
- [ ] **Test 3:** Login as other account → Access denied ✅
- [ ] **Test 4:** Logout works → New login required ✅

---

## Post-Setup

- [ ] Redeploy gs-web Worker (via GitHub Actions or Wrangler)
- [ ] Monitor Cloudflare dashboard for Access logs
- [ ] Document any issues in PR comments

---

## Key URLs

| URL | Purpose |
|-----|---------|
| `https://admin.goldshore.ai/app/dashboard` | Admin dashboard (production) |
| `https://admin.goldshore.ai/login` | Explicit login page |
| `https://admin.goldshore.ai/logout` | Logout |
| `https://admin.goldshore.org/app/dashboard` | Admin dashboard (org) |

---

## Configuration Values

```
Account ID:     f77de112d2019e5456a3198a8bb50bd2
Team Domain:    goldshore.cloudflareaccess.com
Application:    admin-production
Audience:       c520a7647223b49b20fbe5be240772863eb684b97b57c08955b6104c58170db9
IdP:            GitHub
Owners:         marstonr6@gmail.com, admin@goldshore.org
```

---

## Help

If stuck, see `docs/CLOUDFLARE_ACCESS_SETUP.md` for detailed steps and troubleshooting.

