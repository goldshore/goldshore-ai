// Stub — passes all traffic through. No routes are assigned in wrangler.toml
// so this worker is never invoked in production. The file must exist to satisfy
// the wrangler build step.
export default {
  async fetch(_request: Request): Promise<Response> {
    return new Response(null, { status: 404 });
  },
};
