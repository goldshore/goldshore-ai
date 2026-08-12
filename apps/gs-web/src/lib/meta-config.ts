export interface MetaConfig {
  appId: string;
  appSecret: string;
  accessToken: string;
  businessAccountId: string;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  objective: string;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  createdTime: string;
}

export interface MetaAdAccount {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  amountSpent: string;
  balance: string;
}

export interface MetaInsight {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  cpc: number; // Cost per click
  ctr: number; // Click through rate
}

export const getMetaConfig = (): MetaConfig | null => {
  const appId = process.env.META_APP_ID || '';
  const appSecret = process.env.META_APP_SECRET || '';
  const accessToken = process.env.META_ACCESS_TOKEN || '';
  const businessAccountId = process.env.META_BUSINESS_ACCOUNT_ID || '';

  if (!appId || !appSecret || !businessAccountId) {
    console.warn('Meta Business API configuration incomplete');
    return null;
  }

  return { appId, appSecret, accessToken, businessAccountId };
};

export const fetchMetaAdAccounts = async (
  config: MetaConfig
): Promise<MetaAdAccount[] | null> => {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${config.businessAccountId}/ad_accounts?fields=id,name,currency,timezone,amount_spent,balance&access_token=${config.accessToken}`
    );

    if (!response.ok) {
      console.error('Failed to fetch Meta ad accounts');
      return null;
    }

    const data = await response.json();
    return (data.data || []).map((account: Record<string, unknown>) => ({
      id: account.id,
      name: account.name,
      currency: account.currency,
      timezone: account.timezone,
      amountSpent: account.amount_spent || '0',
      balance: account.balance || '0',
    }));
  } catch (error) {
    console.error('Error fetching Meta ad accounts:', error);
    return null;
  }
};

export const fetchMetaCampaigns = async (
  config: MetaConfig,
  adAccountId: string
): Promise<MetaCampaign[] | null> => {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${adAccountId}/campaigns?fields=id,name,status,objective,spent,reach,impressions,actions_results_install,created_time&access_token=${config.accessToken}`
    );

    if (!response.ok) {
      console.error('Failed to fetch Meta campaigns');
      return null;
    }

    const data = await response.json();
    return (data.data || []).map((campaign: Record<string, unknown>) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      objective: campaign.objective,
      spend: parseFloat(String(campaign.spent || 0)),
      reach: parseInt(String(campaign.reach || 0), 10),
      impressions: parseInt(String(campaign.impressions || 0), 10),
      clicks: parseInt(String(campaign.actions_results_install || 0), 10),
      createdTime: campaign.created_time,
    }));
  } catch (error) {
    console.error('Error fetching Meta campaigns:', error);
    return null;
  }
};

export const fetchMetaInsights = async (
  config: MetaConfig,
  adAccountId: string,
  options?: {
    dateStart?: string; // YYYY-MM-DD
    dateStop?: string; // YYYY-MM-DD
    granularity?: 'day' | 'week' | 'month' | 'all_days';
  }
): Promise<MetaInsight[] | null> => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dateStart = options?.dateStart || thirtyDaysAgo.toISOString().split('T')[0];
    const dateStop = options?.dateStop || now.toISOString().split('T')[0];
    const granularity = options?.granularity || 'day';

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${adAccountId}/insights?` +
      `date_preset=last_30d&` +
      `fields=date_start,spend,impressions,clicks,reach,cost_per_action_type,action_type&` +
      `date_start=${dateStart}&` +
      `date_stop=${dateStop}&` +
      `granularity=${granularity}&` +
      `access_token=${config.accessToken}`
    );

    if (!response.ok) {
      console.error('Failed to fetch Meta insights');
      return null;
    }

    const data = await response.json();
    return (data.data || []).map((insight: Record<string, unknown>) => ({
      date: insight.date_start,
      spend: parseFloat(String(insight.spend || 0)),
      impressions: parseInt(String(insight.impressions || 0), 10),
      clicks: parseInt(String(insight.clicks || 0), 10),
      reach: parseInt(String(insight.reach || 0), 10),
      cpc: parseFloat(String(insight.cost_per_action_type || 0)),
      ctr: (parseInt(String(insight.clicks || 0), 10) / parseInt(String(insight.impressions || 1), 10)) * 100,
    }));
  } catch (error) {
    console.error('Error fetching Meta insights:', error);
    return null;
  }
};
