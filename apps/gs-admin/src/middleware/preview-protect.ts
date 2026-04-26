export function enforcePreviewAuth(request: Request) {
  const url = new URL(request.url);

  const isPreview =
    url.hostname.startsWith("preview.");

  if (!isPreview) return;

  const auth = request.headers.get("Authorization");

  if (!auth || auth !== `Bearer ${import.meta.env.PREVIEW_TOKEN}`) {
    return new Response("Unauthorized", { status: 401 });
  }
}
