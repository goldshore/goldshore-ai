import type { APIRoute } from 'astro';
import { getStrapiConfig, fetchStrapiContent, createStrapiContent, updateStrapiContent, deleteStrapiContent } from '../../../lib/strapi-config';

export const GET: APIRoute = async ({ url }) => {
  const config = getStrapiConfig();
  if (!config) {
    return new Response(
      JSON.stringify({ error: 'STRAPI not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') || '10');

  const result = await fetchStrapiContent('articles', config, {
    pagination: { page, pageSize },
    populate: ['author', 'category', 'thumbnail'],
    sort: ['-createdAt'],
  });

  if (!result) {
    return new Response(
      JSON.stringify({ articles: [], total: 0, error: 'Failed to fetch articles' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const config = getStrapiConfig();
  if (!config) {
    return new Response(
      JSON.stringify({ error: 'STRAPI not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const payload = await request.json();
    const result = await createStrapiContent('articles', payload, config);

    if (!result) {
      return new Response(
        JSON.stringify({ error: 'Failed to create article' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ data: result, success: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating article:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create article' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
