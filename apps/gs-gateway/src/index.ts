// Contract stub — actual gateway is deployed from the goldshore-gateway repo as gs-platform.
export default {
  fetch(): Response {
    return new Response('gs-gateway contract stub', { status: 200 });
  },
};
