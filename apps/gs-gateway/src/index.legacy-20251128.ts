export default {
  async fetch(request, env) {
    // Forward the request to the astro-gs-api service
    return await env.API.fetch(request);
  },
};