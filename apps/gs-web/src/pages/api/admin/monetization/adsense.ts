import type { APIRoute } from 'astro';
import { authorizeAdminRequest, getAdminRouteRule } from '../../../../utils/admin-access';
import { getAdSenseConfig, getAdSenseAccessToken, fetchAdSenseAccount, fetchAdSenseReports } from '../../../../lib/adsense';

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env as Env | undefined;
  const rule = getAdminRouteRule('/api/admin/monetization/adsense', 'GET');
  if (!rule) {
    return new Response('Not found.', { status: 404 });
  }

  const authResult = await authorizeAdminRequest(request, env as never, rule);
  if (!authResult.ok) {
    const failure = authResult as Extract<typeof authResult, { ok: false }>;
    return Response.json({ success: false, error: failure.error }, { status: failure.status });
  }

  const config = getAdSenseConfig(env);
  if (!config) {
    return Response.json({ success: false, error: 'AdSense not configured.' }, { status: 503 });
  }

  const accessToken = await getAdSenseAccessToken(config);
  if (!accessToken) {
    return Response.json({ success: false, error: 'Failed to authenticate with AdSense.' }, { status: 502 });
  }

  try {
    const [reports, account] = await Promise.all([
      fetchAdSenseReports(config, accessToken),
      fetchAdSenseAccount(config, accessToken),
    ]);

    if (!reports) {
      return Response.json({ success: false, error: 'Failed to fetch AdSense reports.' }, { status: 502 });
    }

    const totalEarnings = reports.reduce((sum, r) => sum + r.earnings, 0);
    const totalImpressions = reports.reduce((sum, r) => sum + r.impressions, 0);
    const totalClicks = reports.reduce((sum, r) => sum + r.clicks, 0);
    const avgCPM = reports.length ? reports.reduce((sum, r) => sum + r.cpm, 0) / reports.length : 0;

    return Response.json({
      success: true,
      account,
      summary: { totalEarnings, totalImpressions, totalClicks, avgCPM, period: `Last ${reports.length} days` },
      reports: reports.slice(-7),
    });
  } catch {
    return Response.json({ success: false, error: 'AdSense request failed.' }, { status: 502 });
  }
};
