import type { APIRoute } from 'astro';
import Fuse from 'fuse.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON import might require configuration adjustments depending on environment, but works in standard Astro builds
import searchIndex from '../../search-index.json';

// Define the type for our search index items
type SearchItem = {
  title: string;
  slug: string;
};

// Lazy initialization of Fuse instance
let fuse: Fuse<SearchItem> | null = null;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';

  if (!q) return new Response(JSON.stringify([]));

  if (!fuse) {
    fuse = new Fuse(searchIndex as SearchItem[], {
      keys: ['title'],
      threshold: 0.3,
      ignoreLocation: true,
    });
  }

  const results = fuse.search(q)
    .map((result) => ({
      title: result.item.title,
      url: `/developer/docs/${result.item.slug}`,
    }))
    .slice(0, 5);

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
};
