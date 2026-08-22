import type { APIRoute } from 'astro';
import { proxyAdminRequest } from '../../../../lib/api-proxy';

// PR Merge Cockpit's client-side script previously fetched
// `https://api.goldshore.ai/admin/merge-cockpit${path}` directly from the
// browser with `credentials: 'include'`. That's a cross-origin call the
// browser has no valid Access session for (only admin.goldshore.ai's Access
// app gets authenticated on login), so every request hit the same
// HTML-instead-of-JSON failure as the other admin pages. This route lets the
// browser call same-origin `/api/admin/merge-cockpit/*` instead, proxied
// server-side through the API service binding like every other admin route.
const forward: APIRoute = ({ request, locals, params }) =>
  proxyAdminRequest(request, `/admin/merge-cockpit${params.path ? `/${params.path}` : ''}`, locals.PUBLIC_API);

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
