import type { APIRoute } from 'astro';
import { proxyAdminRequest } from '../../../../lib/api-proxy';
export const GET: APIRoute = ({ request, locals, url }) => {
  const name = url.searchParams.get('name');
  return name ? proxyAdminRequest(request, `/system/cf/workers/${encodeURIComponent(name)}`, locals.PUBLIC_API) : Response.json({ success:false,error:'Missing worker name.' }, { status:400 });
};
const mutate: APIRoute = ({ request, locals, url }) => {
  const name = url.searchParams.get('name');
  const binding = url.searchParams.get('binding');
  if (!name || !binding) return Response.json({ success:false,error:'Missing worker or binding name.' }, { status:400 });
  const query = new URLSearchParams(url.searchParams); query.delete('name'); query.delete('binding');
  const suffix = query.size ? `?${query}` : '';
  return proxyAdminRequest(request, `/system/cf/workers/${encodeURIComponent(name)}/bindings/${encodeURIComponent(binding)}${suffix}`, locals.PUBLIC_API);
};
export const PUT = mutate;
export const DELETE = mutate;
