import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGsApiAccessHeaders } from './manage';

test('buildGsApiAccessHeaders forwards Cloudflare Access assertion and cookie', () => {
  const request = new Request('https://admin.goldshore.ai/api/integrations/manage', {
    headers: {
      'CF-Access-Jwt-Assertion': 'verified-access-token',
      Cookie: 'CF_Authorization=verified-access-cookie; session=admin',
    },
  });

  const headers = buildGsApiAccessHeaders(request);

  assert.equal(headers.get('Content-Type'), 'application/json');
  assert.equal(headers.get('CF-Access-Jwt-Assertion'), 'verified-access-token');
  assert.equal(headers.get('Cookie'), 'CF_Authorization=verified-access-cookie; session=admin');
});
