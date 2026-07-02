import type { APIRoute } from 'astro';
import {
  validateKVBinding,
  validateD1Binding,
  validateR2Binding,
  validateServiceBinding,
  generateValidationReport,
} from '../../../lib/cloudflare-validator';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const runtime = locals['runtime'] as Record<string, unknown> | undefined;
    const env = runtime?.env as Record<string, unknown> | undefined;

    // Validate all bindings
    const kvBinding = await validateKVBinding(env?.['KV']);
    const d1Binding = await validateD1Binding(env?.['CONTENT_DB']);
    const r2Binding = await validateR2Binding(env?.['ASSETS']);
    const serviceBinding = await validateServiceBinding();

    const bindings = [kvBinding, d1Binding, r2Binding, serviceBinding];
    const report = generateValidationReport(bindings);

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error validating Cloudflare bindings:', error);
    return new Response(
      JSON.stringify({
        error: 'Validation failed',
        message: 'An unexpected error occurred while validating bindings.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
