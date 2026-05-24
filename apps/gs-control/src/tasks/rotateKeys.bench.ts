import { rotateKeys } from './rotateKeys';
import type { ControlEnv } from '../libs/types';

async function benchmark() {
  const mockKV = {
    put: async (key: string, value: string) => {
      // Simulate network latency
      await new Promise(resolve => setTimeout(resolve, 100));
    },
    get: async () => null,
    delete: async () => {},
    list: async () => ({ keys: [], list_complete: true, cursor: '' }),
  } as unknown as KVNamespace;

  const env = {
    CONTROL_LOGS: mockKV,
  } as ControlEnv;

  console.log('Starting benchmark...');
  const start = performance.now();
  await rotateKeys(env);
  const end = performance.now();
  console.log(`Duration: ${(end - start).toFixed(2)}ms`);
}

benchmark().catch(console.error);
