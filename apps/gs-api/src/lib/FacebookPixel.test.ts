import assert from 'node:assert/strict';
import test from 'node:test';
import { FacebookPixelIntegration } from './FacebookPixel';
import type { IntegrationConfig } from './BaseIntegration';

const sha256 = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

test('FacebookPixelIntegration hashes normalized user_data before sending conversions', async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody: any;

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ events_received: 1 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const config: IntegrationConfig = {
      name: 'meta-pixel',
      provider: 'facebook',
      apiKey: 'pixel-123',
      apiSecret: 'access-token',
      status: 'disconnected',
    };
    const integration = new FacebookPixelIntegration(config);

    const sent = await integration.trackEvent({
      eventId: 'evt-1',
      eventName: 'Lead',
      eventTime: 1,
      userData: {
        email: ' User@Example.COM ',
        phone: '+1 (555) 010-1234',
        firstName: ' Ada ',
        lastName: ' Lovelace ',
        city: ' London ',
        state: ' LND ',
        zipCode: ' SW1A 1AA ',
        country: ' GB ',
      },
    });

    assert.equal(sent, true);
    assert.deepEqual(capturedBody.data[0].user_data, {
      em: await sha256('user@example.com'),
      ph: await sha256('15550101234'),
      fn: await sha256('ada'),
      ln: await sha256('lovelace'),
      ct: await sha256('london'),
      st: await sha256('lnd'),
      zp: await sha256('sw1a 1aa'),
      country: await sha256('gb'),
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
