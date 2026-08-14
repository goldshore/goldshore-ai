import type { APIRoute } from 'astro';
import { proxyApiRequest } from '../../../../lib/api-proxy';
export const GET: APIRoute = ({ request, locals, url }) => {
  const name = url.searchParams.get('name');
  return name ? proxyApiRequest(request, `/system/cf/workers/${encodeURIComponent(name)}`, locals.PUBLIC_API) : Response.json({ success:false,error:'Missing worker name.' }, { status:400 });
};
