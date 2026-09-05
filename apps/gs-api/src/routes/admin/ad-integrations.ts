import { Hono } from 'hono';
import { getActor, logAdminAction, requirePermission } from '../../auth';
import { fetchGoogleAdsCampaigns } from '../../lib/google-ads-client';
import { getSecretMetadata } from '../../lib/secrets';
import type { Env, Variables } from '../../types';

const ads = new Hono<{ Bindings: Env; Variables: Variables }>();
const providers = new Set(['google_ads', 'meta_ads']);
const accountPattern = /^[0-9]{3,32}$/;
const cleanAccountId = (value: string) => value.replace(/[-\s]/g, '');
const pageValues = (c: any) => {
  const page = Math.max(1, Number.parseInt(c.req.query('page') ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(10, Number.parseInt(c.req.query('pageSize') ?? '25', 10) || 25));
  return { page, pageSize, offset: (page - 1) * pageSize };
};
const audit = (c: any, action: string, status: 'success' | 'error', metadata: Record<string, unknown>) =>
  logAdminAction(c.env, { action, actor: getActor(c.get('accessClaims'), c.req.raw), status, metadata });

ads.get('/readiness', requirePermission('system:read'), async (c) => c.json({
  providers: {
    google_ads: { supported: true, mode: 'read_only', developerTokenConfigured: Boolean(c.env.GOOGLE_ADS_DEVELOPER_TOKEN) },
    meta_ads: { supported: false, mode: 'setup_only', message: 'Campaign sync is not enabled until the Meta provider client is configured.' },
  },
  credentials: { storage: 'encrypted', valuesExposed: false },
}));

ads.get('/accounts', requirePermission('system:read'), async (c) => {
  const { page, pageSize, offset } = pageValues(c);
  const rows = await c.env.PLATFORM_DB.prepare(`SELECT id,provider,external_account_id,display_name,currency,timezone,
    credential_secret_id,status,read_only,last_sync_at,last_error,created_at,updated_at FROM ad_accounts ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
    .bind(pageSize, offset).all();
  const count = await c.env.PLATFORM_DB.prepare('SELECT COUNT(*) total FROM ad_accounts').first<{ total: number }>();
  const items = await Promise.all(rows.results.map(async (row: any) => ({
    ...row, read_only: Boolean(row.read_only), credential_secret_id: undefined,
    credential: row.credential_secret_id ? Boolean(await getSecretMetadata(c.env, row.credential_secret_id)) : false,
  })));
  const total = Number(count?.total ?? 0);
  return c.json({ items, pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) } });
});

ads.post('/accounts', requirePermission('system:write'), async (c) => {
  const body = await c.req.json<any>().catch(() => null);
  const provider = String(body?.provider ?? '');
  const externalAccountId = cleanAccountId(String(body?.externalAccountId ?? ''));
  const displayName = String(body?.displayName ?? '').trim();
  if (!providers.has(provider) || !accountPattern.test(externalAccountId) || !displayName || displayName.length > 120) {
    return c.json({ error: 'Provider, numeric account ID, and display name are required.' }, 400);
  }
  let credentialSecretId: string | null = null;
  if (body?.credentialSecretId) {
    const secret = await getSecretMetadata(c.env, String(body.credentialSecretId));
    if (!secret) return c.json({ error: 'Credential secret was not found.' }, 400);
    credentialSecretId = secret.id;
  }
  const id = crypto.randomUUID();
  const status = credentialSecretId && provider === 'google_ads' && c.env.GOOGLE_ADS_DEVELOPER_TOKEN ? 'ready' : 'setup_required';
  try {
    await c.env.PLATFORM_DB.prepare(`INSERT INTO ad_accounts(id,provider,external_account_id,display_name,currency,timezone,credential_secret_id,status,created_by)
      VALUES(?,?,?,?,?,?,?,?,?)`).bind(id, provider, externalAccountId, displayName, String(body.currency ?? 'USD').toUpperCase().slice(0, 3),
      String(body.timezone ?? 'America/New_York').slice(0, 64), credentialSecretId, status, getActor(c.get('accessClaims'), c.req.raw)).run();
  } catch { return c.json({ error: 'That provider account is already registered.' }, 409); }
  await audit(c, 'ads.account.create', 'success', { id, provider, credentialAttached: Boolean(credentialSecretId) });
  return c.json({ id, provider, externalAccountId, displayName, status, readOnly: true }, 201);
});

ads.post('/accounts/:id/sync', requirePermission('system:write'), async (c) => {
  const account = await c.env.PLATFORM_DB.prepare('SELECT * FROM ad_accounts WHERE id=?').bind(c.req.param('id')).first<any>();
  if (!account) return c.json({ error: 'Ad account not found.' }, 404);
  if (account.provider !== 'google_ads') return c.json({ error: 'This provider is setup-only; campaign sync is not enabled.' }, 501);
  if (!account.credential_secret_id || !c.env.GOOGLE_ADS_DEVELOPER_TOKEN) return c.json({ error: 'Attach an OAuth credential and configure the Google Ads developer token first.' }, 409);
  try {
    const campaigns = await fetchGoogleAdsCampaigns(c.env, account.credential_secret_id, account.external_account_id);
    const now = new Date().toISOString();
    await c.env.PLATFORM_DB.batch([
      ...campaigns.map((item) => c.env.PLATFORM_DB.prepare(`INSERT INTO ad_campaign_snapshots
        (id,account_id,campaign_id,campaign_name,impressions,clicks,conversions,cost_micros,ctr,synced_at) VALUES(?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(account_id,campaign_id) DO UPDATE SET campaign_name=excluded.campaign_name,impressions=excluded.impressions,
        clicks=excluded.clicks,conversions=excluded.conversions,cost_micros=excluded.cost_micros,ctr=excluded.ctr,synced_at=excluded.synced_at`)
        .bind(crypto.randomUUID(), account.id, item.campaignId, item.campaignName, item.impressions, item.clicks, item.conversions, item.costMicros, item.ctr, now)),
      c.env.PLATFORM_DB.prepare("UPDATE ad_accounts SET status='ready',last_sync_at=?,last_error=NULL,updated_at=? WHERE id=?").bind(now, now, account.id),
    ]);
    await audit(c, 'ads.account.sync', 'success', { accountId: account.id, campaigns: campaigns.length, mode: 'read_only' });
    return c.json({ success: true, campaigns: campaigns.length, syncedAt: now });
  } catch (error) {
    await c.env.PLATFORM_DB.prepare("UPDATE ad_accounts SET status='error',last_error=?,updated_at=datetime('now') WHERE id=?")
      .bind(error instanceof Error ? error.message.slice(0, 500) : 'Sync failed', account.id).run();
    await audit(c, 'ads.account.sync', 'error', { accountId: account.id });
    return c.json({ error: 'Provider sync failed. Review the account credential and provider access.' }, 502);
  }
});

ads.get('/accounts/:id/campaigns', requirePermission('system:read'), async (c) => {
  const { page, pageSize, offset } = pageValues(c);
  const id = c.req.param('id');
  const rows = await c.env.PLATFORM_DB.prepare('SELECT campaign_id,campaign_name,impressions,clicks,conversions,cost_micros,ctr,synced_at FROM ad_campaign_snapshots WHERE account_id=? ORDER BY cost_micros DESC LIMIT ? OFFSET ?').bind(id, pageSize, offset).all();
  const count = await c.env.PLATFORM_DB.prepare('SELECT COUNT(*) total FROM ad_campaign_snapshots WHERE account_id=?').bind(id).first<{ total: number }>();
  const total = Number(count?.total ?? 0);
  return c.json({ items: rows.results, pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) } });
});

export default ads;
