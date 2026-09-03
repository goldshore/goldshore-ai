# Environment Configuration & Management

**Purpose**: Define local, preview, and production environments for troubleshooting.

**Scope**: goldshore-ai monorepo (gs-web + gs-api)  
**Updated**: 2026-09-03

---

## 🌍 Environment Tiers

### Local Development
**Branch**: `claude/*`, `codex/*`, or feature branches  
**URL**: `http://localhost:8787`  
**Database**: Local D1 (via `wrangler dev`)  
**Bindings**: Mock/local overrides in `wrangler.toml`  
**When to use**: Initial development, local testing, debugging

**Setup**:
```bash
git checkout main
git pull origin main
pnpm install
pnpm build

# Run each app in separate terminal:
cd apps/gs-web && npm run dev
cd apps/gs-api && wrangler dev --env preview
```

**Testing**:
- Visit http://localhost:3000 (gs-web dev server)
- API available at http://localhost:8787 (gs-api worker)
- Changes auto-reload (except Wrangler config changes)

---

### Preview/Staging
**Branch**: `preview/*`, PR branches  
**URL**: `preview.goldshore.ai`  
**Database**: `PLATFORM_DB` (preview env in D1)  
**Bindings**: Same as production, but preview-scoped  
**When to use**: Testing before main merge, QA validation, client demos

**Deploy**:
```bash
# Automatic via GitHub Actions on PR creation
# Or manual:
git push origin feature-branch
# Actions auto-deploy preview.goldshore.ai
```

**Access**:
- Visit preview.goldshore.ai
- Check PR for deploy status
- View logs: Cloudflare Dashboard → Workers → gs-api-preview

**Rollback**:
```bash
# If preview breaks:
git push origin revert-commit-sha:preview/main
# Or just close PR (GitHub auto-unpublishes preview)
```

---

### Production
**Branch**: `main`  
**URL**: `goldshore.ai`, `api.goldshore.ai`  
**Database**: `PLATFORM_DB` (production env in D1)  
**Bindings**: Full production (Stripe, integrations, etc.)  
**When to use**: Live customer traffic  

**Deploy**:
```bash
# Automatic when commit merged to main
# Or manual rollback:
git push origin previous-commit:main
```

**Access**:
- https://goldshore.ai (public site)
- https://api.goldshore.ai (API gateway, requires Cloudflare Access)
- Logs: `wrangler tail gs-api --env production`
- Monitor: Cloudflare Dashboard

**Status Check**:
```bash
curl -I https://goldshore.ai  # Should return 200
curl https://api.goldshore.ai/health  # Check API health
```

---

## 🔧 Local Setup & Troubleshooting

### Initial Clone & Install
```bash
git clone https://github.com/marzton/goldshore-ai.git
cd goldshore-ai
pnpm install --force  # --force if lock issues
pnpm build
```

### Common Local Issues

**Issue: `wrangler dev` fails to start**
```bash
# Kill old Wrangler process
pkill -f "wrangler dev"

# Clear cache
rm -rf .wrangler

# Retry
cd apps/gs-api && wrangler dev --env preview
```

**Issue: Port 8787 already in use**
```bash
# Find process using port
lsof -i :8787

# Kill it
kill -9 <PID>

# Or use different port
wrangler dev --port 9000
```

**Issue: D1 database not initialized**
```bash
# Reset D1 locally (if using preview env)
wrangler d1 execute DB --command "SELECT 1"

# Or migrate schema
wrangler d1 migrations apply DB
```

**Issue: Types don't match between gs-web and gs-api**
```bash
# Full type check
pnpm tsc --noEmit --workspace

# If gs-api types changed:
# → Make sure gs-api exports all types
# → Run pnpm build in gs-api first
# → Then rebuild gs-web
```

---

## 📊 Environment Variables & Secrets

### Required for Local Dev
```bash
# .env.local (create in root)
CLOUDFLARE_API_TOKEN=xxx  # From Cloudflare Dashboard
CLOUDFLARE_ACCOUNT_ID=xxx
TURNSTILE_SECRET_KEY=xxx  # For form validation
```

### Required for Preview/Production
All secrets stored in **Cloudflare Workers Secrets Store**:
- `STRIPE_SECRET_KEY` (live mode)
- `WHATSAPP_BUSINESS_API_KEY`
- `GOOGLE_SERVICE_ACCOUNT_KEY`
- `META_BUSINESS_MANAGER_TOKEN`

**Rotate every 90 days** (Codex responsibility)

### Checking Current Secrets
```bash
# List secrets (requires Cloudflare API access)
wrangler secret list

# Verify binding is accessible in code
# gs-api/src/index.ts should have access to env.DB, env.KV, etc.
```

---

## 🚀 Deployment Checklist

### Before Pushing to Main
```bash
git fetch origin
git rebase origin/main
pnpm install --force
pnpm build
pnpm tsc --noEmit --workspace
cd apps/gs-api && wrangler deploy --dry-run  # Verify deploy works
git push -u origin main
```

### Monitor Post-Deploy
```bash
# Watch logs for 5 minutes
wrangler tail gs-api --env production

# Check error budget
# → Cloudflare Dashboard → Workers → gs-api → Analytics

# Test endpoints
curl https://api.goldshore.ai/health
curl https://goldshore.ai
```

### If Deploy Fails
```bash
# Check GitHub Actions logs
# → Actions → Deploy → Latest run

# Check Cloudflare limits
# → Account → Billing → Usage (check invocation limit)

# Rollback if critical
git push origin previous-commit:main
```

---

## 🔄 Syncing Environments

### Sync Feature Branch to Preview
```bash
# Push to GitHub
git push origin feature-branch

# Actions auto-deploy to preview.goldshore.ai
# Check PR for deploy status

# Verify changes live
curl https://preview.goldshore.ai/api/...
```

### Sync Main to Production
```bash
# Merge PR to main (requires 1 approval)
# GitHub Actions auto-deploy to goldshore.ai

# Verify production
curl https://goldshore.ai
wrangler tail gs-api --env production
```

### Sync Preview Back to Main (Hotfix)
```bash
# If preview has critical fix not in main:
git checkout preview/main  # or fetch and checkout

# Create hotfix branch
git checkout -b hotfix/critical-fix

# Cherry-pick fix if needed
git cherry-pick <commit-sha>

# Push to main
git push origin hotfix/critical-fix
# → Open PR, get approval, merge
```

---

## 📈 Performance & Health Monitoring

### Check All Environments
```bash
# Local
curl -I http://localhost:8787

# Preview  
curl -I https://preview.goldshore.ai

# Production
curl -I https://goldshore.ai
wrangler tail gs-api --env production | head -20
```

### Database Health
```bash
# Check D1 connection
wrangler d1 execute PLATFORM_DB --command "SELECT COUNT(*) as total FROM users"

# Check quota usage
# → Cloudflare Dashboard → D1 → Database → Quota
```

### Worker Performance
```bash
# View invocation metrics
wrangler analytics gs-api --env production

# Check error rate
wrangler tail gs-api --env production --format json | grep "error"
```

---

## 🔐 Security Notes

- Never commit secrets to git (use .gitignore)
- Never share Cloudflare tokens in chat (use Secrets Store)
- Rotate secrets every 90 days
- Use Cloudflare Access for admin routes (requires VPN/SSO)
- Monitor for exposed tokens in GitHub (check Security tab)

---

**Maintainer**: Claude | **Last Updated**: 2026-09-03 | **Next Review**: 2026-09-10
