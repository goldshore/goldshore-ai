export interface StrapiConfig {
  apiUrl: string;
  apiToken: string;
}

export interface StrapiContent {
  id: string | number;
  documentId?: string;
  attributes?: Record<string, unknown>;
  title?: string;
  slug?: string;
  content?: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
}

export interface StrapiResponse<T> {
  data: T | T[];
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export const getStrapiConfig = (): StrapiConfig | null => {
  // Get from environment or Cloudflare env
  const apiUrl = process.env.STRAPI_API_URL || '';
  const apiToken = process.env.STRAPI_API_TOKEN || '';

  if (!apiUrl || !apiToken) {
    console.warn('STRAPI configuration missing. Set STRAPI_API_URL and STRAPI_API_TOKEN');
    return null;
  }

  return { apiUrl, apiToken };
};

export const fetchStrapiContent = async (
  contentType: string,
  config: StrapiConfig,
  options?: {
    filters?: Record<string, unknown>;
    populate?: string | string[];
    pagination?: { page: number; pageSize: number };
    sort?: string | string[];
  }
): Promise<StrapiResponse<StrapiContent> | null> => {
  try {
    const url = new URL(`${config.apiUrl}/api/${contentType}`);

    if (options?.filters) {
      url.searchParams.append('filters', JSON.stringify(options.filters));
    }

    if (options?.populate) {
      const populate = Array.isArray(options.populate) ? options.populate : [options.populate];
      populate.forEach((p) => url.searchParams.append('populate', p));
    }

    if (options?.pagination) {
      url.searchParams.append('pagination[page]', String(options.pagination.page));
      url.searchParams.append('pagination[pageSize]', String(options.pagination.pageSize));
    }

    if (options?.sort) {
      const sorts = Array.isArray(options.sort) ? options.sort : [options.sort];
      sorts.forEach((s) => url.searchParams.append('sort', s));
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`STRAPI API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: StrapiResponse<StrapiContent> = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching STRAPI content:', error);
    return null;
  }
};

export const createStrapiContent = async (
  contentType: string,
  payload: Record<string, unknown>,
  config: StrapiConfig
): Promise<StrapiContent | null> => {
  try {
    const url = `${config.apiUrl}/api/${contentType}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: payload }),
    });

    if (!response.ok) {
      console.error(`STRAPI API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const result: StrapiResponse<StrapiContent> = await response.json();
    return Array.isArray(result.data) ? result.data[0] : result.data;
  } catch (error) {
    console.error('Error creating STRAPI content:', error);
    return null;
  }
};

export const updateStrapiContent = async (
  contentType: string,
  id: string | number,
  payload: Record<string, unknown>,
  config: StrapiConfig
): Promise<StrapiContent | null> => {
  try {
    const url = `${config.apiUrl}/api/${contentType}/${id}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: payload }),
    });

    if (!response.ok) {
      console.error(`STRAPI API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const result: StrapiResponse<StrapiContent> = await response.json();
    return Array.isArray(result.data) ? result.data[0] : result.data;
  } catch (error) {
    console.error('Error updating STRAPI content:', error);
    return null;
  }
};

export const deleteStrapiContent = async (
  contentType: string,
  id: string | number,
  config: StrapiConfig
): Promise<boolean> => {
  try {
    const url = `${config.apiUrl}/api/${contentType}/${id}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Error deleting STRAPI content:', error);
    return false;
  }
};
