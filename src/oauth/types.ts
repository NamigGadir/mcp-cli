/**
 * OAuth type definitions
 */

import type { Server } from 'node:http';

/**
 * OAuth configuration from server config
 */
export interface OAuthConfig {
  grantType?: 'authorization_code' | 'client_credentials';
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  callbackPort?: number;
  /** Optional: explicit list of ports to try in order (overrides default fallback) */
  callbackPorts?: number[];
  /**
   * Whether to automatically open the authorization URL in the system's
   * default browser once it is ready. Defaults to `true`. Set to `false`
   * to keep the previous non-interactive behavior (URL is only captured/
   * printed, never opened automatically) - useful for headless/CI/agent
   * environments without a usable display.
   */
  autoOpenBrowser?: boolean;
}

/**
 * Result from OAuth callback
 */
export interface OAuthCallbackResult {
  code: string;
}

/**
 * Callback server state for managing the OAuth callback listener
 */
export interface CallbackServerState {
  server: Server;
  promise: Promise<OAuthCallbackResult>;
  cleanup: () => void;
}

// Default callback port for OAuth redirect
export const DEFAULT_CALLBACK_PORT = 8095;

// Default port: random (0) - OS assigns unique port for each server, avoiding conflicts
export const DEFAULT_PORT_FALLBACK_ORDER = [0];
