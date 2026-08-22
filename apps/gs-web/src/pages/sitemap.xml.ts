export const prerender = false;

export async function GET({ url }: { url: URL }) {
  const baseUrl = url.origin;

  const pages = [
    // Main pages
    { url: '/', priority: 1.0, changefreq: 'weekly' },
    { url: '/about', priority: 0.8, changefreq: 'monthly' },
    { url: '/team', priority: 0.7, changefreq: 'monthly' },
    { url: '/contact', priority: 0.8, changefreq: 'weekly' },
    { url: '/services', priority: 0.9, changefreq: 'monthly' },

    // Services
    { url: '/services/ai-implementation', priority: 0.8, changefreq: 'monthly' },
    { url: '/services/consulting', priority: 0.8, changefreq: 'monthly' },
    { url: '/services/design-dev', priority: 0.8, changefreq: 'monthly' },
    { url: '/services/digital-strategy', priority: 0.8, changefreq: 'monthly' },
    { url: '/services/systems-integration', priority: 0.8, changefreq: 'monthly' },
    { url: '/services/banproof', priority: 0.8, changefreq: 'monthly' },
    { url: '/services/bridgekeeper', priority: 0.8, changefreq: 'monthly' },

    // Platform & Products
    { url: '/platform', priority: 0.9, changefreq: 'weekly' },
    { url: '/platform/ai-oracle', priority: 0.8, changefreq: 'weekly' },
    { url: '/platform/financial-signals', priority: 0.8, changefreq: 'weekly' },
    { url: '/platform/sentinel', priority: 0.8, changefreq: 'weekly' },
    { url: '/platform/workflow-engine', priority: 0.8, changefreq: 'weekly' },
    { url: '/apps/risk-radar', priority: 0.85, changefreq: 'daily' },
    { url: '/risk-radar', priority: 0.85, changefreq: 'daily' },

    // Solutions
    { url: '/solutions', priority: 0.8, changefreq: 'monthly' },
    { url: '/products', priority: 0.8, changefreq: 'monthly' },
    { url: '/pricing', priority: 0.7, changefreq: 'monthly' },
    { url: '/blog', priority: 0.7, changefreq: 'weekly' },
    { url: '/sectors/financial-services', priority: 0.7, changefreq: 'monthly' },
    { url: '/sectors/operations-logistics', priority: 0.7, changefreq: 'monthly' },
    { url: '/sectors/media-communications', priority: 0.7, changefreq: 'monthly' },
    { url: '/sectors/healthcare-systems', priority: 0.7, changefreq: 'monthly' },
    { url: '/sectors/public-sector', priority: 0.7, changefreq: 'monthly' },
    { url: '/sectors/enterprise-tech', priority: 0.7, changefreq: 'monthly' },

    // Developer
    { url: '/developer', priority: 0.8, changefreq: 'weekly' },
    { url: '/developer/docs', priority: 0.7, changefreq: 'weekly' },
    { url: '/developer/api', priority: 0.7, changefreq: 'weekly' },
    { url: '/developer/mcp', priority: 0.7, changefreq: 'monthly' },
    { url: '/developer/sdk', priority: 0.7, changefreq: 'monthly' },
    { url: '/features', priority: 0.7, changefreq: 'monthly' },
    { url: '/templates', priority: 0.7, changefreq: 'monthly' },
    { url: '/intake', priority: 0.6, changefreq: 'monthly' },

    // Status & Support
    { url: '/status', priority: 0.5, changefreq: 'hourly' },

    // Legal
    { url: '/legal', priority: 0.3, changefreq: 'yearly' },
    { url: '/legal/privacy', priority: 0.5, changefreq: 'yearly' },
    { url: '/legal/terms', priority: 0.5, changefreq: 'yearly' },
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (page) => `
  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join('')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
