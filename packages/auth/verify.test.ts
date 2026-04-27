import { test, describe, before, beforeEach, after, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { verifyAccess, verifyAccessWithClaims, verifyAccessWithClaimsInternal, type Env, type Dependencies, deps } from './verify.ts';

describe('verifyAccess', () => {
    let mockDeps: Dependencies;
    let createRemoteJWKSetMock: any;
    let jwtVerifyMock: any;

    before(() => {
        // Initialize mocks with safe defaults
        createRemoteJWKSetMock = mock.fn(() => ({}));
        jwtVerifyMock = mock.fn(async () => ({ payload: {} }));

        mockDeps = {
            createRemoteJWKSet: createRemoteJWKSetMock,
            jwtVerify: jwtVerifyMock,
        };
    });

    beforeEach(() => {
        // Reset call history
        createRemoteJWKSetMock.mock.resetCalls();
        jwtVerifyMock.mock.resetCalls();
        // Reset implementation to default safe behavior
        jwtVerifyMock.mock.mockImplementation(async () => ({ payload: {} }));
        createRemoteJWKSetMock.mock.mockImplementation(() => ({}));
    });

    after(() => {
        mock.reset();
    });

    const testVerify = async (req: Request, env: Env) => {
        return verifyAccessWithClaimsInternal(req, env, mockDeps);
    };

    test('returns null when no token header is present', async () => {
        const req = new Request('http://example.com');
        const env: Env = {};
        const result = await testVerify(req, env);
        assert.strictEqual(result, null);
    });

    test('returns null when jwtVerify throws an error (invalid token)', async () => {
        const req = new Request('http://example.com', {
            headers: { 'CF-Access-Jwt-Assertion': 'invalid-token' }
        });
        const env: Env = {};

        jwtVerifyMock.mock.mockImplementation(async () => {
            throw new Error('Invalid token');
        });

        const result = await testVerify(req, env);
        assert.strictEqual(result, null);
        assert.strictEqual(jwtVerifyMock.mock.callCount(), 1);
    });

    test('returns payload when jwtVerify succeeds (valid token)', async () => {
        const req = new Request('http://example.com', {
            headers: { 'CF-Access-Jwt-Assertion': 'valid-token' }
        });
        const env: Env = {};
        const mockPayload = { sub: 'user123', email: 'test@example.com' };

        jwtVerifyMock.mock.mockImplementation(async () => {
            return { payload: mockPayload };
        });

        const result = await testVerify(req, env);
        assert.deepStrictEqual(result, mockPayload);
        assert.strictEqual(jwtVerifyMock.mock.callCount(), 1);
    });

    test('passes audience to jwtVerify when configured', async () => {
        const req = new Request('http://example.com', {
            headers: { 'CF-Access-Jwt-Assertion': 'valid-token' }
        });
        const env: Env = { CLOUDFLARE_ACCESS_AUDIENCE: 'my-audience' };
        const mockPayload = { sub: 'user123' };

        jwtVerifyMock.mock.mockImplementation(async () => {
            return { payload: mockPayload };
        });

        await testVerify(req, env);

        const calls = jwtVerifyMock.mock.calls[0];
        assert.strictEqual(calls.arguments[2].audience, 'my-audience');
    });

    test('uses correct issuer based on env', async () => {
        const req = new Request('http://example.com', {
            headers: { 'CF-Access-Jwt-Assertion': 'valid-token' }
        });
        const env: Env = { CLOUDFLARE_TEAM_DOMAIN: 'custom.team.com' };
        const mockPayload = { sub: 'user123' };

        jwtVerifyMock.mock.mockImplementation(async () => {
            return { payload: mockPayload };
        });

        await testVerify(req, env);

        const calls = jwtVerifyMock.mock.calls[0];
        assert.strictEqual(calls.arguments[2].issuer, 'https://custom.team.com');
    });

    test('normalizes short Cloudflare Access team names to a full domain', async () => {
        const req = new Request('http://example.com', {
            headers: { 'CF-Access-Jwt-Assertion': 'valid-token' }
        });
        const env: Env = { CLOUDFLARE_TEAM_DOMAIN: 'gsl-ops' };

        await testVerify(req, env);

        const calls = createRemoteJWKSetMock.mock.calls[0];
        assert.strictEqual(calls.arguments[0].toString(), 'https://gsl-ops.cloudflareaccess.com/cdn-cgi/access/certs');
        assert.strictEqual(jwtVerifyMock.mock.calls[0].arguments[2].issuer, 'https://gsl-ops.cloudflareaccess.com');
    });

    test('verifyAccess public wrapper returns boolean (false for no token)', async () => {
         const req = new Request('http://example.com');
         const env: Env = {};
         const result = await verifyAccess(req, env);
         assert.strictEqual(result, false);
    });

    test('verifyAccess returns true for valid token', async () => {
        const req = new Request('http://example.com', {
            headers: { 'CF-Access-Jwt-Assertion': 'valid-token' }
        });
        const env: Env = {};

        // Mock deps.jwtVerify directly as verifyAccess calls verifyAccessWithClaims
        // which uses the real deps.jwtVerify
        const jwtVerifyMockLocal = mock.method(deps, 'jwtVerify', async () => {
            return { payload: { sub: 'user123' } };
        });

        const result = await verifyAccess(req, env);
        assert.strictEqual(result, true);

        jwtVerifyMockLocal.mock.restore();
    });

    test('verifyAccess returns false for invalid token', async () => {
        const req = new Request('http://example.com', {
            headers: { 'CF-Access-Jwt-Assertion': 'invalid-token' }
        });
        const env: Env = {};

        const jwtVerifyMockLocal = mock.method(deps, 'jwtVerify', async () => {
            throw new Error('Invalid token');
        });

        // Suppress console.error for this test
        const consoleErrorMock = mock.method(console, 'error', () => {});

        const result = await verifyAccess(req, env);
        assert.strictEqual(result, false);

        jwtVerifyMockLocal.mock.restore();
        consoleErrorMock.mock.restore();
    });
});

describe('verifyAccessWithClaims (public)', () => {
    let consoleErrorMock: any;
    let jwtVerifyMock: any;

    beforeEach(() => {
        // Spy on console.error to prevent noise and verify it's called
        consoleErrorMock = mock.method(console, 'error', () => {});
    });

    afterEach(() => {
        // Restore mocks
        if (consoleErrorMock) consoleErrorMock.mock.restore();
        if (jwtVerifyMock) jwtVerifyMock.mock.restore();
    });

    test('catches error and returns null when verification fails', async () => {
        const req = new Request('http://example.com', {
            headers: { 'CF-Access-Jwt-Assertion': 'invalid-token' }
        });
        const env: Env = {};

        // Mock deps.jwtVerify to throw
        jwtVerifyMock = mock.method(deps, 'jwtVerify', async () => {
            throw new Error('Verification failed');
        });

        const result = await verifyAccessWithClaims(req, env);

        assert.strictEqual(result, null);
        assert.strictEqual(consoleErrorMock.mock.callCount(), 1);
        const args = consoleErrorMock.mock.calls[0].arguments;
        assert.strictEqual(args[0], "Token verification failed");
    });

    test('returns payload when verification succeeds', async () => {
        const req = new Request('http://example.com', {
            headers: { 'CF-Access-Jwt-Assertion': 'valid-token' }
        });
        const env: Env = {};
        const mockPayload = { sub: 'user123', email: 'test@example.com' };

        // Mock deps.jwtVerify to return success
        jwtVerifyMock = mock.method(deps, 'jwtVerify', async () => {
            return { payload: mockPayload };
        });

        const result = await verifyAccessWithClaims(req, env);

        assert.deepStrictEqual(result, mockPayload);
        assert.strictEqual(consoleErrorMock.mock.callCount(), 0);
    });
});
