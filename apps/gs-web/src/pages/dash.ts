export const prerender = false;

export function GET({ request }: { request: Request }) {
  return Response.redirect(new URL('/app/dashboard', request.url), 307);
}
