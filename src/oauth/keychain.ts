/**
 * macOS Keychain-backed secret storage.
 *
 * OAuth access/refresh tokens are the most sensitive artifacts mcp-cli
 * persists. On macOS we store them in the user's login Keychain (via the
 * `security` CLI) instead of a plaintext JSON file, so they benefit from
 * OS-level encryption at rest and Keychain ACLs. On non-macOS platforms
 * (or if the `security` binary is unavailable) callers should fall back to
 * the existing file-based storage in storage.ts.
 */

import { execFileSync } from 'node:child_process';
import { debug } from '../config.js';

const SERVICE = 'mcp-cli-oauth-tokens';

/** Keychain "account" field — one entry per MCP server. */
function accountFor(serverName: string): string {
  return serverName;
}

/**
 * Whether this platform can use macOS Keychain storage.
 * Checked lazily (not cached) so tests can stub `process.platform`.
 *
 * Set MCP_CLI_DISABLE_KEYCHAIN=1 to force file-based storage even on macOS —
 * used by the test suite so it never touches the developer's real login
 * Keychain (mirrors how MCP_CLI_HOME isolates file storage in tests).
 */
export function isKeychainSupported(): boolean {
  if (process.env.MCP_CLI_DISABLE_KEYCHAIN === '1') return false;
  return process.platform === 'darwin';
}

/**
 * Read a secret from the macOS Keychain. Returns undefined if not
 * supported, not found, or the `security` call fails for any reason.
 */
export function keychainRead(serverName: string): string | undefined {
  if (!isKeychainSupported()) return undefined;
  try {
    const out = execFileSync(
      'security',
      [
        'find-generic-password',
        '-a',
        accountFor(serverName),
        '-s',
        SERVICE,
        '-w',
      ],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const value = out.toString('utf-8').trim();
    return value.length > 0 ? value : undefined;
  } catch (error) {
    debug(
      `Keychain read miss for "${serverName}": ${(error as Error).message}`,
    );
    return undefined;
  }
}

/**
 * Write (or overwrite) a secret in the macOS Keychain.
 * Returns true on success, false if unsupported or the write failed —
 * callers should fall back to file storage in that case.
 */
export function keychainWrite(serverName: string, secret: string): boolean {
  if (!isKeychainSupported()) return false;
  try {
    execFileSync(
      'security',
      [
        'add-generic-password',
        '-a',
        accountFor(serverName),
        '-s',
        SERVICE,
        '-w',
        secret,
        '-U', // update in place if an entry already exists
      ],
      { stdio: ['ignore', 'ignore', 'ignore'] },
    );
    return true;
  } catch (error) {
    debug(
      `Keychain write failed for "${serverName}": ${(error as Error).message}`,
    );
    return false;
  }
}

/**
 * Delete a secret from the macOS Keychain. No-op if unsupported or missing.
 */
export function keychainDelete(serverName: string): void {
  if (!isKeychainSupported()) return;
  try {
    execFileSync(
      'security',
      ['delete-generic-password', '-a', accountFor(serverName), '-s', SERVICE],
      { stdio: ['ignore', 'ignore', 'ignore'] },
    );
  } catch (error) {
    debug(
      `Keychain delete miss for "${serverName}": ${(error as Error).message}`,
    );
  }
}
