import type { APIRoute } from 'astro';
import { getAdSenseConfig, getAdSenseAccessToken, fetchAdSenseAccount, fetchAdSenseReports } from '../../../lib/adsense-config';

export const GET: APIRoute = async ({ url }) => {
  const config = getAdSenseConfig();
  if (!config) {
    return new Response(
      JSON.stringify({ error: 'AdSense not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const accessToken = await getAdSenseAccessToken(config);
  if (!accessToken) {
    return new Response(
      JSON.stringify({ error: 'Failed to authenticate with AdSense' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const type = url.searchParams.get('type') || 'summary';

  try {
    if (type === 'account') {
      const account = await fetchAdSenseAccount(config, accessToken);
      if (!account) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch account' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ data: account, success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (type === 'reports') {
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');

      const reports = await fetchAdSenseReports(config, accessToken, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      if (!reports) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch reports' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ data: reports, success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Default: summary view
    const reports = await fetchAdSenseReports(config, accessToken);
    const account = await fetchAdSenseAccount(config, accessToken);

    if (!reports) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch reports' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const totalEarnings = reports.reduce((sum, r) => sum + r.earnings, 0);
    const totalImpressions = reports.reduce((sum, r) => sum + r.impressions, 0);
    const totalClicks = reports.reduce((sum, r) => sum + r.clicks, 0);
    const avgCPM = reports.length > 0 ? reports.reduce((sum, r) => sum + r.cpm, 0) / reports.length : 0;
    const avgRPM = reports.length > 0 ? reports.reduce((sum, r) => sum + r.rpm, 0) / reports.length : 0;

    return new Response(
      JSON.stringify({
        success: true,
        account,
        summary: {
          totalEarnings,
          totalImpressions,
          totalClicks,
          avgCPM,
          avgRPM,
          period: `Last ${reports.length} days`,
        },
        reports: reports.slice(-7), // Last 7 days
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('AdSense API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
