import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateTunnelIngress } from './system';

describe('Cloudflare tunnel safeguards', () => {
  it('accepts GoldShore ingress with a safe terminal catch-all', () => {
    assert.equal(validateTunnelIngress([
      { hostname: 'admin.goldshore.ai', service: 'http://localhost:4321' },
      { service: 'http_status:404' },
    ]), true);
  });

  it('rejects foreign hostnames and missing catch-all rules', () => {
    assert.equal(validateTunnelIngress([{ hostname: 'example.com', service: 'http://localhost:4321' }, { service: 'http_status:404' }]), false);
    assert.equal(validateTunnelIngress([{ hostname: 'admin.goldshore.ai', service: 'http://localhost:4321' }]), false);
  });

  it('rejects unsafe services', () => {
    assert.equal(validateTunnelIngress([{ hostname: 'admin.goldshore.ai', service: 'file:///etc/passwd' }, { service: 'http_status:404' }]), false);
  });
});
