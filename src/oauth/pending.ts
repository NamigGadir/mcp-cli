/**
 * Tracks in-flight OAuth completions.
 *
 * When a server requires authorization, the CLI returns an auth URL to the
 * caller immediately (so AI agents aren't blocked) while a background
 * callback server keeps listening for the redirect. That listener - and the
 * token exchange that follows once the code arrives - runs as a dangling
 * promise in the same process. If the CLI force-exits right after printing
 * the auth URL, that promise (and the callback server's open socket) is
 * killed before the user can even open the link.
 *
 * Command handlers must check `hasPendingOAuth()` before calling
 * `process.exit()` so the event loop is allowed to stay alive - kept open by
 * the callback server's listening socket - until the flow completes or the
 * 5 minute timeout elapses.
 */
const pending = new Set<Promise<unknown>>();

export function registerPendingOAuth(promise: Promise<unknown>): void {
  pending.add(promise);
  promise.finally(() => pending.delete(promise));
}

export function hasPendingOAuth(): boolean {
  return pending.size > 0;
}
