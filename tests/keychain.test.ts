/**
 * Unit tests for macOS Keychain-backed token storage.
 *
 * All `security` CLI calls are mocked via spyOn — these tests never touch
 * the developer's real login Keychain, and run the same on any platform/CI.
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as childProcess from 'node:child_process';
import {
  isKeychainSupported,
  keychainDelete,
  keychainRead,
  keychainWrite,
} from '../src/oauth/keychain';

describe('keychain', () => {
  const originalPlatform = process.platform;

  function setPlatform(platform: NodeJS.Platform) {
    Object.defineProperty(process, 'platform', { value: platform });
  }

  afterEach(() => {
    setPlatform(originalPlatform);
    delete process.env.MCP_CLI_DISABLE_KEYCHAIN;
  });

  describe('isKeychainSupported', () => {
    test('returns true on darwin', () => {
      setPlatform('darwin');
      expect(isKeychainSupported()).toBe(true);
    });

    test('returns false on non-darwin platforms', () => {
      setPlatform('linux');
      expect(isKeychainSupported()).toBe(false);
    });

    test('returns false when MCP_CLI_DISABLE_KEYCHAIN=1, even on darwin', () => {
      setPlatform('darwin');
      process.env.MCP_CLI_DISABLE_KEYCHAIN = '1';
      expect(isKeychainSupported()).toBe(false);
    });
  });

  describe('with mocked `security` CLI (darwin)', () => {
    beforeEach(() => {
      setPlatform('darwin');
    });

    test('keychainRead returns the stored secret', () => {
      const spy = spyOn(childProcess, 'execFileSync').mockReturnValue(
        Buffer.from('super-secret-token\n'),
      );

      const result = keychainRead('my-server');

      expect(result).toBe('super-secret-token');
      expect(spy).toHaveBeenCalledWith(
        'security',
        ['find-generic-password', '-a', 'my-server', '-s', 'mcp-cli-oauth-tokens', '-w'],
        expect.anything(),
      );
      spy.mockRestore();
    });

    test('keychainRead returns undefined when item not found', () => {
      const spy = spyOn(childProcess, 'execFileSync').mockImplementation(() => {
        throw new Error('SecKeychainSearchCopyNext: The specified item could not be found');
      });

      expect(keychainRead('missing-server')).toBeUndefined();
      spy.mockRestore();
    });

    test('keychainWrite invokes add-generic-password with -U and returns true', () => {
      const spy = spyOn(childProcess, 'execFileSync').mockReturnValue(Buffer.from(''));

      const result = keychainWrite('my-server', '{"access_token":"abc"}');

      expect(result).toBe(true);
      expect(spy).toHaveBeenCalledWith(
        'security',
        [
          'add-generic-password',
          '-a',
          'my-server',
          '-s',
          'mcp-cli-oauth-tokens',
          '-w',
          '{"access_token":"abc"}',
          '-U',
        ],
        expect.anything(),
      );
      spy.mockRestore();
    });

    test('keychainWrite returns false when `security` call fails', () => {
      const spy = spyOn(childProcess, 'execFileSync').mockImplementation(() => {
        throw new Error('security: command failed');
      });

      expect(keychainWrite('my-server', 'secret')).toBe(false);
      spy.mockRestore();
    });

    test('keychainDelete invokes delete-generic-password', () => {
      const spy = spyOn(childProcess, 'execFileSync').mockReturnValue(Buffer.from(''));

      keychainDelete('my-server');

      expect(spy).toHaveBeenCalledWith(
        'security',
        ['delete-generic-password', '-a', 'my-server', '-s', 'mcp-cli-oauth-tokens'],
        expect.anything(),
      );
      spy.mockRestore();
    });

    test('keychainDelete is a no-op (does not throw) when item is missing', () => {
      const spy = spyOn(childProcess, 'execFileSync').mockImplementation(() => {
        throw new Error('item not found');
      });

      expect(() => keychainDelete('missing-server')).not.toThrow();
      spy.mockRestore();
    });
  });

  describe('on non-darwin platforms', () => {
    beforeEach(() => {
      setPlatform('linux');
    });

    test('keychainRead is a no-op returning undefined without calling `security`', () => {
      const spy = spyOn(childProcess, 'execFileSync');

      expect(keychainRead('my-server')).toBeUndefined();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    test('keychainWrite is a no-op returning false without calling `security`', () => {
      const spy = spyOn(childProcess, 'execFileSync');

      expect(keychainWrite('my-server', 'secret')).toBe(false);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    test('keychainDelete is a no-op without calling `security`', () => {
      const spy = spyOn(childProcess, 'execFileSync');

      keychainDelete('my-server');

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
