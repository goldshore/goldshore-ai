/**
 * goldshore-ai Worker
 *
 * NOTE: The real goldshore.ai site is served by the gs-web Pages project.
 * This Worker exists as a thin layer for:
 *   - /health endpoint
 *   - Any edge logic not handled by Pages (auth headers, redirects, etc.)
 *
 * If Cloudflare Pages is handling goldshore.ai as a custom domain,
 * this Worker's routes should be removed to avoid conflicts.
 */

export interface Env {
  ENV: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, service: 'goldshore-ai', env: env.ENV }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // All other traffic: let Pages handle it
    // If this Worker is conflicting with the Pages custom domain, remove the route in the dashboard
    return Response.redirect('https://goldshore.ai', 301);
  },
} satisfies ExportedHandler<Env>;
