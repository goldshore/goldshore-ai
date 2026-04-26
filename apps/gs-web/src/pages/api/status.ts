import type { APIRoute } from 'astro';
import { getStatusSummary, statusSnapshot } from '../../data/status';

export const GET: APIRoute = async () => {
  const summary = getStatusSummary(statusSnapshot.components);

  return Response.json({
    ...statusSnapshot,
    summary,
  });
};
