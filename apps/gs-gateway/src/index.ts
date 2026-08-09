// Contract stub for the repo-managed gateway package.
// Production routes and secrets are defined in wrangler.toml for gs-gateway-prod.
export default {
  fetch(): Response {
    return new Response('gs-gateway contract stub', { status: 200 });
  },
};
