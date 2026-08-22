import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getInternalAuthorizationEnv,
  getInternalVerificationEnv,
  isInternalPath,
} from './access-context';

const env = {
  CLOUDFLARE_ACCESS_AUDIENCE: 'api-audience',
  CLOUDFLARE_ACCESS_APPLICATION: 'api-production',
  CLOUDFLARE_SERVICE_ACCESS_AUDIENCE: 'service-audience',
};

describe('internal Access contexts', () => {
  it('only classifies the internal route boundary', () => {
    assert.equal(isInternalPath('/internal/inbox-status'), true);
    assert.equal(isInternalPath('/internalized'), false);
  });

  it('verifies service and forwarded admin audiences', () => {
    assert.deepEqual(
      getInternalVerificationEnv(env, 'admin-audience').CLOUDFLARE_ACCESS_AUDIENCE,
      ['service-audience', 'admin-audience'],
    );
  });

  it('authorizes a service token against the service role map', () => {
    assert.equal(
      getInternalAuthorizationEnv(env, { aud: 'service-audience' }).CLOUDFLARE_ACCESS_APPLICATION,
      'service-production',
    );
  });

  it('authorizes a forwarded admin token against the API user role map', () => {
    assert.equal(getInternalAuthorizationEnv(env, { aud: ['admin-audience'] }), env);
  });
});
