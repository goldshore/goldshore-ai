import test from 'node:test';
import assert from 'node:assert';
import { ThemeManager } from './manager.ts';

test('ThemeManager.init', async (t) => {
  await t.test('sets theme from localStorage if present', (t) => {
    const getItemMock = t.mock.fn((key: string) => {
      if (key === 'goldshore.theme.v1') return 'dark';
      return null;
    });
    const setAttributeMock = t.mock.fn();

    // @ts-ignore
    global.localStorage = { getItem: getItemMock };
    // @ts-ignore
    global.document = {
      documentElement: {
        setAttribute: setAttributeMock
      }
    } as any;

    ThemeManager.init();

    assert.strictEqual(getItemMock.mock.callCount(), 1);
    assert.strictEqual(setAttributeMock.mock.callCount(), 1);
    assert.strictEqual(setAttributeMock.mock.calls[0].arguments[0], 'data-theme');
    assert.strictEqual(setAttributeMock.mock.calls[0].arguments[1], 'dark');
  });

  await t.test('does nothing if localStorage is empty', (t) => {
    const getItemMock = t.mock.fn(() => null);
    const setAttributeMock = t.mock.fn();

    // @ts-ignore
    global.localStorage = { getItem: getItemMock };
    // @ts-ignore
    global.document = {
      documentElement: {
        setAttribute: setAttributeMock
      }
    } as any;

    ThemeManager.init();

    assert.strictEqual(getItemMock.mock.callCount(), 1);
    assert.strictEqual(setAttributeMock.mock.callCount(), 0);
  });
});

test('ThemeManager.setTheme', (t) => {
  const setItemMock = t.mock.fn();
  const setAttributeMock = t.mock.fn();

  // @ts-ignore
  global.localStorage = { setItem: setItemMock };
  // @ts-ignore
  global.document = {
    documentElement: {
      setAttribute: setAttributeMock
    }
  } as any;

  ThemeManager.setTheme('light');

  assert.strictEqual(setItemMock.mock.callCount(), 1);
  assert.strictEqual(setItemMock.mock.calls[0].arguments[0], 'goldshore.theme.v1');
  assert.strictEqual(setItemMock.mock.calls[0].arguments[1], 'light');

  assert.strictEqual(setAttributeMock.mock.callCount(), 1);
  assert.strictEqual(setAttributeMock.mock.calls[0].arguments[0], 'data-theme');
  assert.strictEqual(setAttributeMock.mock.calls[0].arguments[1], 'light');
});
