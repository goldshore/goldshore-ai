import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';

const PORT = 3001;
const SECRET = 'test-secret';
const GITHUB_TOKEN = 'dummy-token';
const GITHUB_ORG = 'dummy-org';
const GITHUB_REPO = 'dummy-repo';

const env = {
  ...process.env,
  PORT: String(PORT),
  WEBHOOK_SECRET: SECRET,
  GITHUB_TOKEN,
  GITHUB_ORG,
  GITHUB_REPO,
};

console.log('Starting server...');
const server = spawn('node', ['src/index.mjs'], {
  cwd: path.resolve('apps/jules-bot'),
  env,
  stdio: 'inherit'
});

// Wait for server to start
await new Promise(resolve => setTimeout(resolve, 2000));

async function testRequest(name, payload, signatureOverride) {
  console.log(`\nTest: ${name}`);
  const body = JSON.stringify(payload);

  let signature;
  if (signatureOverride !== undefined) {
    signature = signatureOverride;
  } else {
    const hmac = crypto.createHmac('sha256', SECRET);
    const digest = hmac.update(body).digest('hex');
    signature = `sha256=${digest}`;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'x-github-event': 'ping',
  };

  if (signature) {
    headers['x-hub-signature-256'] = signature;
  }

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      method: 'POST',
      headers,
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

try {
  // Test 1: Valid signature
  const res1 = await testRequest('Valid Signature', { msg: 'hello' });
  if (res1.status === 200) {
    console.log('✅ PASS: Valid signature accepted');
  } else {
    console.error(`❌ FAIL: Valid signature rejected with ${res1.status}`);
    process.exitCode = 1;
  }

  // Test 2: Invalid signature
  const res2 = await testRequest('Invalid Signature', { msg: 'hello' }, 'sha256=invalid');
  if (res2.status === 401) {
    console.log('✅ PASS: Invalid signature rejected');
  } else {
    console.error(`❌ FAIL: Invalid signature got ${res2.status}`);
    process.exitCode = 1;
  }

  // Test 3: No signature
  const res3 = await testRequest('No Signature', { msg: 'hello' }, null);
  if (res3.status === 401) {
    console.log('✅ PASS: No signature rejected');
  } else {
    console.error(`❌ FAIL: No signature got ${res3.status}`);
    process.exitCode = 1;
  }

} catch (err) {
  console.error('Test failed with error:', err);
  process.exitCode = 1;
} finally {
  server.kill();
}
