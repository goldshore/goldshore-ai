export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const apex = url.hostname.replace(/^www\./, "");
    url.hostname = apex;
    return Response.redirect(url.toString(), 308);
  },
};
