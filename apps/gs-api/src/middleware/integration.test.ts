import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('middleware integration', () => {
  describe('request pipeline', () => {
    it('verifies correlation ID middleware is positioned after CORS in index.ts', () => {
      const indexPath = resolve(__dirname, '../index.ts');
      const indexContent = readFileSync(indexPath, 'utf8');

      const corsLine = indexContent.indexOf('createCorsMiddleware');
      const correlationLine = indexContent.indexOf("app.use('*', correlationIdMiddleware)");

      assert.ok(corsLine > 0, 'CORS middleware should be imported and used');
      assert.ok(correlationLine > corsLine, 'Correlation ID middleware should come after CORS middleware');
    });

    it('verifies correlation ID middleware is exported from correlation-id.ts', () => {
      const middlePath = resolve(__dirname, './correlation-id.ts');
      const content = readFileSync(middlePath, 'utf8');

      assert.ok(
        content.includes('export async function correlationIdMiddleware'),
        'correlationIdMiddleware should be exported',
      );
    });

    it('verifies Variables type includes correlationId in types.ts', () => {
      const typesPath = resolve(__dirname, '../types.ts');
      const content = readFileSync(typesPath, 'utf8');

      const variablesMatch = content.match(/export type Variables = \{[^}]*correlationId[^}]*\}/s);
      assert.ok(variablesMatch, 'Variables type should include correlationId field');
    });

    it('verifies CORS middleware is configured with security headers', () => {
      const corsPath = resolve(__dirname, '../../../../packages/shared/src/cors.ts');
      const content = readFileSync(corsPath, 'utf8');

      assert.ok(
        content.includes('X-Goldshore-Request-Id') || content.includes('CF-Access-Jwt-Assertion'),
        'CORS should handle correlation ID and CF Access headers',
      );
      assert.ok(content.includes('credentials: true'), 'CORS should allow credentials');
    });

    it('verifies auth middleware is configured with Access JWT handling', () => {
      const indexPath = resolve(__dirname, '../index.ts');
      const indexContent = readFileSync(indexPath, 'utf8');

      assert.ok(
        indexContent.includes('verifyAccessWithClaims') || indexContent.includes('CLOUDFLARE_ACCESS_AUDIENCE'),
        'Auth middleware should verify Cloudflare Access JWTs',
      );
    });

    it('verifies health check endpoints are available', () => {
      const indexPath = resolve(__dirname, '../index.ts');
      const indexContent = readFileSync(indexPath, 'utf8');

      assert.ok(
        indexContent.includes("app.route('/health'") && indexContent.includes("readinessHandler"),
        'Health check endpoints should be configured',
      );
    });
  });
});
