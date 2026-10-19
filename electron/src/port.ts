/**
 * Kawdly People — loopback port selection for the bundled PHP server (T3).
 *
 * The desktop app must not take a fixed port: the user's machine may already be
 * running something on it (this project's own dev machine has an unrelated ERP on
 * 8000), and two copies of the app must never fight over the same socket.
 *
 * Strategy: try a short list of preferred ports so the URL stays stable and
 * recognisable across restarts, then fall back to an OS-assigned ephemeral port
 * so startup can never fail for lack of a port.
 *
 * ⚠️ TOCTOU: this probes availability by binding, then closes the socket and hands
 * the number to a child process. Another process can claim it in the gap. That is
 * unavoidable without passing an inherited socket (PHP's built-in server cannot
 * accept one), so the readiness probe is the real guard: if PHP fails to bind it
 * dies immediately and `waitForBackend` reports a timeout with PHP's stderr tail
 * ("Failed to listen on 127.0.0.1:NNNN"). Retrying with a new port belongs to T4
 * supervision, not here.
 */

import * as net from 'node:net';

/** The server binds loopback only — never 0.0.0.0. */
const BIND_HOST = '127.0.0.1';

/**
 * Per-attempt ceiling. A `listen()` on loopback resolves in microseconds, so this
 * only exists to stop a pathological stack (LSP/filter driver, antivirus hooking
 * winsock) from hanging startup forever.
 */
const ATTEMPT_TIMEOUT_MS = 200;

/**
 * Attempts to bind `port` on loopback.
 *
 * @param port 0 asks the OS for any free ephemeral port.
 * @returns the bound port number, or null if it is taken / the attempt timed out.
 */
function tryBind(port: number): Promise<number | null> {
  return new Promise<number | null>((resolve) => {
    const server = net.createServer();
    let settled = false;

    const timer = setTimeout(() => {
      finish(null);
    }, ATTEMPT_TIMEOUT_MS);

    function finish(result: number | null): void {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      server.removeAllListeners('error');
      server.removeAllListeners('listening');

      // close() on a server that never listened invokes its callback with
      // ERR_SERVER_NOT_RUNNING, so only close what is actually open.
      if (server.listening) {
        server.close(() => resolve(result));
      } else {
        resolve(result);
      }
    }

    server.on('error', () => {
      // EADDRINUSE / EACCES / anything else: this port is not usable.
      finish(null);
    });

    server.on('listening', () => {
      const address = server.address();
      finish(typeof address === 'object' && address !== null ? address.port : null);
    });

    // `exclusive` keeps the probe honest: without it a port already bound by
    // another process in the same cluster group could appear free.
    server.listen({ host: BIND_HOST, port, exclusive: true });
  });
}

/**
 * Resolves a free loopback port.
 *
 * @param preferred ports to try first, in order. Empty is allowed (straight to
 *                  an OS-assigned port).
 * @throws if even an ephemeral port cannot be bound — at that point the network
 *         stack is broken and there is nothing useful to retry.
 */
export async function pickFreePort(preferred: number[]): Promise<number> {
  for (const port of preferred) {
    const bound = await tryBind(port);
    if (bound !== null) {
      return bound;
    }
  }

  const ephemeral = await tryBind(0);
  if (ephemeral !== null) {
    return ephemeral;
  }

  throw new Error(
    `pickFreePort: could not bind any of [${preferred.join(', ')}] on ${BIND_HOST}, ` +
      'and the OS refused an ephemeral port as well.',
  );
}
