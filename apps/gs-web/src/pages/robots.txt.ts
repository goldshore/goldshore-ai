export const prerender = false;

export async function GET({ url }: { url: URL }) {
  const baseUrl = url.origin;
  const robots = `# ${url.hostname} robots.txt
User-agent: *
Allow: /
Allow: /apps/
Allow: /platform/
Allow: /services/
Allow: /developer/
Allow: /blog/

# Disallow private/admin areas
Disallow: /admin/
Disallow: /app/
Disallow: /api/
Disallow: /login
Disallow: /thank-you
Disallow: /intake

# Search engines
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

# Slow crawlers - limit requests
User-agent: AhrefsBot
Crawl-delay: 10

User-agent: SemrushBot
Crawl-delay: 10

# Sitemap reference
Sitemap: ${baseUrl}/sitemap.xml

# Crawl delay in seconds for all crawlers
Crawl-delay: 1

# Request rate limiting
Request-rate: 1/1s`;

  return new Response(robots, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
