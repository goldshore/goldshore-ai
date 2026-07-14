export default {
  async fetch(_request: Request): Promise<Response> {
    return Response.redirect('https://goldshore.ai', 301);
  },
};
