import type { APIRoute } from 'astro';
import { getWebReleaseMarker } from '../../utils/release-marker';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(`${JSON.stringify(getWebReleaseMarker())}\n`, {
    status: 200,
    headers: {
      'cache-control': 'public, max-age=60, must-revalidate',
      'content-type': 'application/json; charset=utf-8',
    },
  });
