import { test } from 'node:test';
import assert from 'node:assert';
import { getCloudflareContext, getCloudflareMetrics } from '../../src/lib/cloudflare.ts';

test('getCloudflareContext returns runtime env when present', () => {
  const mockEnv = { TEST_VAR: 'test' };
  const locals = {
    runtime: {
      env: mockEnv
    }
  };
  const result = getCloudflareContext(locals);
  assert.strictEqual(result, mockEnv);
});

test('getCloudflareContext returns process.env when runtime.env is missing', () => {
  const locals = {
    runtime: {}
  };
  const result = getCloudflareContext(locals);
  assert.strictEqual(result, process.env);
});

test('getCloudflareContext returns process.env when runtime is missing', () => {
  const locals = {};
  const result = getCloudflareContext(locals);
  assert.strictEqual(result, process.env);
});

test('getCloudflareMetrics returns a valid mocked metrics payload', async () => {
  const startTime = Date.now();
  const metrics = await getCloudflareMetrics();
  const endTime = Date.now();

  assert.strictEqual(metrics.source, 'mock');
  assert.strictEqual(typeof metrics.refreshedAt, 'string');

  // Verify refreshedAt is a valid ISO string and within the expected timeframe
  const refreshedTime = new Date(metrics.refreshedAt).getTime();
  assert.ok(!isNaN(refreshedTime), 'refreshedAt should be a valid date');
  assert.ok(refreshedTime >= startTime && refreshedTime <= endTime, 'refreshedAt should be recent');

  assert.strictEqual(
    metrics.note,
    'Metrics are currently mocked for development and testing.'
  );

  // Assert exact highlight values
  assert.deepStrictEqual(metrics.highlights, {
    totalRequests: '1.2M',
    cacheHitRate: '94.2%',
    threatsBlocked: '1,420',
    dnsChanges: '0'
  });

  // Verify charts content
  assert.ok(metrics.charts.requests);
  assert.ok(metrics.charts.bandwidth);

  // Requests chart details
  assert.strictEqual(metrics.charts.requests.title, 'Requests');
  assert.strictEqual(metrics.charts.requests.trend, 'up');
  assert.strictEqual(metrics.charts.requests.series[0].label, 'Mon');
  assert.strictEqual(metrics.charts.requests.series[0].value, 150000);
  assert.strictEqual(metrics.charts.requests.series[0].display, '150k');

  // Bandwidth chart details
  assert.strictEqual(metrics.charts.bandwidth.title, 'Bandwidth');
  assert.strictEqual(metrics.charts.bandwidth.trend, 'down');
  assert.strictEqual(metrics.charts.bandwidth.series[0].label, 'Mon');
  assert.strictEqual(metrics.charts.bandwidth.series[0].value, 45);
  assert.strictEqual(metrics.charts.bandwidth.series[0].display, '45GB');

  for (const chart of Object.values(metrics.charts)) {
    assert.strictEqual(typeof chart.title, 'string');
    assert.strictEqual(typeof chart.description, 'string');
    assert.strictEqual(typeof chart.summary, 'string');
    assert.ok(['up', 'down', 'steady'].includes(chart.trend));
    assert.ok(Array.isArray(chart.series));
    assert.ok(chart.series.length === 7); // Mocked data has 7 days
  }
});
