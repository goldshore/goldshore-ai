import { test, describe, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createLogger } from './logger';

describe('createLogger', () => {
  let logs: string[] = [];
  let originalConsoleLog: any;
  let originalConsoleWarn: any;
  let originalConsoleError: any;

  beforeEach(() => {
    logs = [];
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    originalConsoleError = console.error;

    console.log = (...args: any[]) => logs.push(args.join(' '));
    console.warn = (...args: any[]) => logs.push(args.join(' '));
    console.error = (...args: any[]) => logs.push(args.join(' '));
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  test('should log info with correct format', () => {
    const logger = createLogger('test-context');
    logger.info('hello world');

    assert.strictEqual(logs.length, 1);
    // Regex to match ISO timestamp at start
    assert.match(logs[0], /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] \[test-context\] hello world$/);
  });

  test('should log error with correct format', () => {
    const logger = createLogger('test-context');
    logger.error('oops');

    assert.strictEqual(logs.length, 1);
    assert.match(logs[0], /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[ERROR\] \[test-context\] oops$/);
  });

   test('should log warn with correct format', () => {
    const logger = createLogger('test-context');
    logger.warn('warning');

    assert.strictEqual(logs.length, 1);
    assert.match(logs[0], /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[WARN\] \[test-context\] warning$/);
  });
});
