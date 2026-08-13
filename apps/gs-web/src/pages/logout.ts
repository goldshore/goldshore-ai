import type { APIRoute } from 'astro';

import { getAdminLogoutUrl } from '../utils/admin-access';

export const GET: APIRoute = ({ request, redirect }) => {
  return redirect(getAdminLogoutUrl(request.url), 302);
};
