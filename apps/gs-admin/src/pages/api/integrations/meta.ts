import type { APIRoute } from 'astro';
import { getMetaConfig, fetchMetaAdAccounts, fetchMetaCampaigns, fetchMetaInsights } from '../../../lib/meta-config';

export const GET: APIRoute = async ({ url }) => {
  const config = getMetaConfig();
  if (!config) {
    return new Response(
      JSON.stringify({ error: 'Meta Business API not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const type = url.searchParams.get('type') || 'summary';

  try {
    if (type === 'accounts') {
      const accounts = await fetchMetaAdAccounts(config);
      if (!accounts) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch accounts' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ data: accounts, success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (type === 'campaigns') {
      const accountId = url.searchParams.get('accountId');
      if (!accountId) {
        return new Response(
          JSON.stringify({ error: 'accountId parameter required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const campaigns = await fetchMetaCampaigns(config, accountId);
      if (!campaigns) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch campaigns' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ data: campaigns, success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (type === 'insights') {
      const accountId = url.searchParams.get('accountId');
      if (!accountId) {
        return new Response(
          JSON.stringify({ error: 'accountId parameter required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const insights = await fetchMetaInsights(config, accountId);
      if (!insights) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch insights' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ data: insights, success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Default: summary view
    const accounts = await fetchMetaAdAccounts(config);
    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No ad accounts found' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const firstAccount = accounts[0];
    const campaigns = await fetchMetaCampaigns(config, firstAccount.id);
    const insights = await fetchMetaInsights(config, firstAccount.id);

    const totalSpend = insights ? insights.reduce((sum, i) => sum + i.spend, 0) : 0;
    const totalImpressions = insights ? insights.reduce((sum, i) => sum + i.impressions, 0) : 0;
    const totalClicks = insights ? insights.reduce((sum, i) => sum + i.clicks, 0) : 0;
    const totalReach = insights ? insights.reduce((sum, i) => sum + i.reach, 0) : 0;
    const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    return new Response(
      JSON.stringify({
        success: true,
        accounts,
        summary: {
          totalSpend,
          totalImpressions,
          totalClicks,
          totalReach,
          avgCPC,
          avgCTR,
          activeCampaigns: campaigns ? campaigns.filter((c) => c.status === 'ACTIVE').length : 0,
          totalCampaigns: campaigns ? campaigns.length : 0,
          period: 'Last 30 days',
        },
        insights: insights ? insights.slice(-7) : [], // Last 7 days
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Meta API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
