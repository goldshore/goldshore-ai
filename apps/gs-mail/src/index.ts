// Email worker — processes inbound mail forwarded by Cloudflare Email Routing.
export default {
  async fetch(): Promise<Response> {
    return new Response('gs-mail', { status: 200 });
  },
};
