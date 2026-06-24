import assert from 'node:assert/strict';
import test from 'node:test';
import { proxyToTrading } from './trading-api';

test('forwards the Cloudflare Access assertion through a service binding', async () => {
  let forwardedRequest: Request | undefined;
  const incomingRequest = new Request('https://admin.goldshore.ai/api/trading/accounts', {
    headers: { 'CF-Access-Jwt-Assertion': 'verified-access-token' },
  });

  const response = await proxyToTrading(
    {
      TRADING_SERVICE: {
        fetch: async (request) => {
          forwardedRequest = request;
          return new Response(null, { status: 204 });
        },
      },
    },
    incomingRequest,
    '/api/trading/accounts',
  );

  assert.equal(response.status, 204);
  assert.ok(forwardedRequest);
  assert.equal(new URL(forwardedRequest.url).pathname, '/api/trading/accounts');
  assert.equal(
    forwardedRequest.headers.get('CF-Access-Jwt-Assertion'),
    'verified-access-token',
  );
});
