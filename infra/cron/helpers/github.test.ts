import { test, describe } from 'node:test';
import assert from 'node:assert';
import { findOpenConflicts, gh } from './github.ts';

describe('findOpenConflicts', () => {
  test('should return only dirty PRs', async () => {
    // Mock list
    (gh.rest.pulls.list as any) = async () => {
      return {
        data: [
          { number: 1, title: 'PR 1' },
          { number: 2, title: 'PR 2' },
          { number: 3, title: 'PR 3' },
        ]
      };
    };

    // Mock get
    (gh.rest.pulls.get as any) = async ({ pull_number }: { pull_number: number }) => {
      const states: Record<number, string> = {
        1: 'clean',
        2: 'dirty',
        3: 'unstable'
      };
      return {
        data: { mergeable_state: states[pull_number] }
      };
    };

    const results = await findOpenConflicts('owner', 'repo');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].number, 2);
  });

  test('should return empty array if no PRs are dirty', async () => {
    (gh.rest.pulls.list as any) = async () => ({ data: [{ number: 1 }] });
    (gh.rest.pulls.get as any) = async () => ({ data: { mergeable_state: 'clean' } });

    const results = await findOpenConflicts('owner', 'repo');
    assert.strictEqual(results.length, 0);
  });

  test('should handle empty PR list', async () => {
    (gh.rest.pulls.list as any) = async () => ({ data: [] });

    const results = await findOpenConflicts('owner', 'repo');
    assert.strictEqual(results.length, 0);
  });
});
