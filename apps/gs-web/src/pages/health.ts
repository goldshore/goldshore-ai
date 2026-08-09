export const prerender = false;

export function GET({ url }: { url: URL }) {
  return Response.json(
    {
      ok: true,
      service: 'gs-web',
      environment: 'production',
      host: url.hostname,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
