import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseConfig, DEFAULT_CONFIG, SystemConfig, loadSystemSyncSnapshot } from './system.config';

describe('System Config Logic', () => {
  describe('parseConfig', () => {
    it('returns default config when input is null', () => {
      const result = parseConfig(null);
      assert.deepStrictEqual(result, DEFAULT_CONFIG);
    });

    it('returns default config when input is empty object', () => {
      // Note: maintenanceMode becomes false, which matches DEFAULT_CONFIG
      const result = parseConfig({});
      assert.deepStrictEqual(result, DEFAULT_CONFIG);
    });

    it('correctly parses valid full config', () => {
      const input: SystemConfig = {
        maintenanceMode: true,
        maxConcurrency: 50,
        notes: "Maintenance window"
      };
      const result = parseConfig(input);
      assert.deepStrictEqual(result, { ...DEFAULT_CONFIG, ...input });
    });

    it('merges partial config with defaults', () => {
      const input = {
        maintenanceMode: true
      };
      const result = parseConfig(input);
      assert.deepStrictEqual(result, {
        ...DEFAULT_CONFIG,
        maintenanceMode: true
      });
    });

    describe('maintenanceMode', () => {
      it('handles boolean values', () => {
        assert.strictEqual(parseConfig({ maintenanceMode: true }).maintenanceMode, true);
        assert.strictEqual(parseConfig({ maintenanceMode: false }).maintenanceMode, false);
      });

      it('defaults to false when undefined', () => {
        assert.strictEqual(parseConfig({}).maintenanceMode, false);
      });
    });

    describe('maxConcurrency', () => {
      it('accepts valid integers', () => {
        assert.strictEqual(parseConfig({ maxConcurrency: 100 }).maxConcurrency, 100);
      });

      it('floors floating point numbers', () => {
        assert.strictEqual(parseConfig({ maxConcurrency: 10.9 }).maxConcurrency, 10);
      });

      it('enforces minimum value of 1', () => {
        assert.strictEqual(parseConfig({ maxConcurrency: 0 }).maxConcurrency, 1);
        assert.strictEqual(parseConfig({ maxConcurrency: -10 }).maxConcurrency, 1);
      });

      it('falls back to default for non-finite numbers', () => {
        assert.strictEqual(parseConfig({ maxConcurrency: Infinity }).maxConcurrency, DEFAULT_CONFIG.maxConcurrency);
        assert.strictEqual(parseConfig({ maxConcurrency: NaN }).maxConcurrency, DEFAULT_CONFIG.maxConcurrency);
      });

      it('falls back to default for non-number types', () => {
        // @ts-expect-error testing runtime behavior
        assert.strictEqual(parseConfig({ maxConcurrency: "100" }).maxConcurrency, DEFAULT_CONFIG.maxConcurrency);
        // @ts-expect-error testing runtime behavior
        assert.strictEqual(parseConfig({ maxConcurrency: null }).maxConcurrency, DEFAULT_CONFIG.maxConcurrency);
      });
    });

    describe('notes', () => {
      it('accepts valid strings', () => {
        assert.strictEqual(parseConfig({ notes: "valid note" }).notes, "valid note");
      });

      it('truncates strings longer than 500 chars', () => {
        const longNote = "a".repeat(600);
        const result = parseConfig({ notes: longNote });
        assert.strictEqual(result.notes.length, 500);
        assert.strictEqual(result.notes, "a".repeat(500));
      });

      it('falls back to default for non-string types', () => {
        // @ts-expect-error testing runtime behavior
        assert.strictEqual(parseConfig({ notes: 123 }).notes, DEFAULT_CONFIG.notes);
        // @ts-expect-error testing runtime behavior
        assert.strictEqual(parseConfig({ notes: null }).notes, DEFAULT_CONFIG.notes);
      });
    });
  });
});


describe('loadSystemSyncSnapshot', () => {
  it('preserves valid sections when one snapshot section is malformed', async () => {
    const kv = {
      get: async (key: string) => {
        if (key === 'ROUTING_TABLE') {
          return {
            'example.com': { role: 'backend', target: 'https://origin.example.com', priority: 1 },
          };
        }
        if (key === 'SERVICE_STATUS') {
          return { maintenance_mode: false, active_services: ['api'], version: '2026.03.04' };
        }
        if (key === 'AI_ORCHESTRATION') {
          return { preferred_model: 'gpt-5-mini', agent_modules: ['mail'], queue_concurrency: 5, retry_attempts: 2 };
        }
        if (key === 'EMAIL_INBOX_LOGS') {
          return [{ id: 123, from: 'bad@example.com' }];
        }
        return null;
      },
    } as unknown as KVNamespace;

    const snapshot = await loadSystemSyncSnapshot(kv);

    assert.deepStrictEqual(snapshot.SERVICE_STATUS.active_services, ['api']);
    assert.strictEqual(snapshot.SERVICE_STATUS.version, '2026.03.04');
    assert.deepStrictEqual(snapshot.ROUTING_TABLE['example.com']?.target, 'https://origin.example.com');
    assert.deepStrictEqual(snapshot.EMAIL_INBOX_LOGS, []);
  });
});
