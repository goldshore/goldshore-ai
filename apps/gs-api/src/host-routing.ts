const HOST_ROUTE_PREFIXES = new Map<string, string>([
  ['api.goldshore.ai', ''],
  ['api.goldshore.org', ''],
  ['agent.goldshore.ai', '/agent'],
  ['mail.goldshore.ai', '/mail'],
  ['ops.goldshore.ai', '/control'],
  ['trading.goldshore.ai', '/trading'],
  ['dashboard.goldshore.ai', '/trading'],
  ['dash.goldshore.ai', '/trading'],
  ['gw.goldshore.ai', '/core'],
]);

/** Map every hostname alias into the canonical route tree mounted by gs-api. */
export const getHostRoutePrefix = (request: Request): string | undefined =>
  HOST_ROUTE_PREFIXES.get(new URL(request.url).hostname.toLowerCase());
