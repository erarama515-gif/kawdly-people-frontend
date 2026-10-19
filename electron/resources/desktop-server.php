<?php

/**
 * Kawdly People — router script for the bundled PHP built-in server (T4).
 *
 * Replaces Illuminate/Foundation/resources/server.php. Same contract, one extra
 * job: undo the URI-to-script resolution that php -S performs BEFORE this file
 * is ever executed.
 *
 * ---------------------------------------------------------------------------
 * The bug this exists to fix (F14)
 * ---------------------------------------------------------------------------
 * The built-in server resolves a "script" for the request before handing control
 * to the router. It walks the URI against the document root, and when it lands on
 * a directory it applies its directory-index rule. Once the Vite build has been
 * staged into public/app/, a request for /app/employees/42 therefore arrives with:
 *
 *     SCRIPT_NAME     = /app/index.html
 *     SCRIPT_FILENAME = <public>/app/index.html
 *     PATH_INFO       = /employees/42
 *
 * Laravel's stock router then requires public/index.php, but Symfony's
 * Request::prepareBaseUrl() reads those variables, derives baseUrl = '/app' and
 * strips it from the path. Laravel sees 'employees/42', matches nothing, and
 * returns 404. The SPA fallback route in routes/web.php is correct — it is simply
 * never reached.
 *
 * ---------------------------------------------------------------------------
 * The fix
 * ---------------------------------------------------------------------------
 * Rewrite the three $_SERVER keys prepareBaseUrl() consults so they describe the
 * script that is *actually* about to run (public/index.php), drop PATH_INFO, and
 * only then delegate. baseUrl collapses to '' and Laravel sees the full
 * '/app/employees/42', which the fallback route matches.
 *
 * Why all three keys and not just SCRIPT_NAME:
 *   prepareBaseUrl() compares basename(SCRIPT_FILENAME) against
 *   basename(SCRIPT_NAME). Setting SCRIPT_NAME alone leaves 'index.php' facing
 *   'index.html', the comparison fails, and Symfony drops into its IIS
 *   compatibility branch. That branch happens to also produce '' here, but by a
 *   long accident rather than by design — it reverse-walks SCRIPT_FILENAME's path
 *   segments against PHP_SELF. Pinning SCRIPT_FILENAME too makes the first,
 *   intended comparison match, so the outcome no longer depends on a fallback
 *   that exists for a web server we do not run.
 *
 * ---------------------------------------------------------------------------
 * Return contract
 * ---------------------------------------------------------------------------
 * `return false` hands the request back to php -S, which serves the file from
 * disk with its own MIME handling and range support. That is the right outcome
 * for hashed Vite assets and images, and nothing PHP does could be faster.
 *
 * It is returned ONLY for a real file. Directories deliberately fall through to
 * Laravel: /app/ must be answered by the spa route so the no-store header on the
 * document is actually applied. Under the stock router /app/ was answered by the
 * static handler instead, so that header silently did nothing.
 */

// ---------------------------------------------------------------------------
// 1. Describe the script that is really about to run.
// ---------------------------------------------------------------------------

/**
 * php -S always exports DOCUMENT_ROOT (from -t, or the cwd when -t is absent).
 * The cwd fallback is correct for this app specifically: spawnPhp() sets
 * cwd = <backend>/public, which IS the document root. Note that it is NOT
 * getcwd().'/public' — that would be <backend>/public/public.
 */
$docRoot = $_SERVER['DOCUMENT_ROOT'] ?? getcwd();
$frontController = $docRoot . DIRECTORY_SEPARATOR . 'index.php';

$_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['PHP_SELF'] = '/index.php';
$_SERVER['SCRIPT_FILENAME'] = $frontController;

// Set by php -S whenever it split the URI around a resolved script. Symfony adds
// it back onto the path it computes, so leaving it in place double-counts the
// tail of every deep link.
unset($_SERVER['PATH_INFO'], $_SERVER['ORIG_PATH_INFO']);

// ---------------------------------------------------------------------------
// 2. Decide: static file, or Laravel?
// ---------------------------------------------------------------------------

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$uri = is_string($uri) ? urldecode($uri) : '/';

/**
 * A %00 in the URI survives urldecode and reaches the filesystem functions
 * below, where PHP 8 throws a ValueError ("must not contain any null bytes").
 * An uncaught ValueError in a router script is a 500. Laravel's stock router has
 * the same hole via its file_exists() call; a crafted URL should be a boring 404,
 * so refuse the path outright and let Laravel render the error.
 */
if (str_contains($uri, "\0")) {
    $uri = '/';
}

$candidate = realpath($docRoot . $uri);
$rootReal = realpath($docRoot);

if (
    $candidate !== false
    && $rootReal !== false
    && is_file($candidate)
    && str_starts_with($candidate, $rootReal . DIRECTORY_SEPARATOR)
) {
    // realpath() has already collapsed any ../ segments, so the prefix test above
    // is a genuine containment check and not a string-matching guess. Anything
    // that escaped the document root fails it and falls through to Laravel, which
    // answers 404 rather than leaking the file.
    return false;
}

// ---------------------------------------------------------------------------
// 3. Everything else is Laravel's: SPA fallback, API, storage, errors.
// ---------------------------------------------------------------------------

/**
 * Request log on stdout, matching the stock router's format. spawnPhp() pipes
 * stdout to <userData>/logs/php-stdout.log, so dropping this would quietly remove
 * the only per-request trace the desktop build has. Static hits are not logged,
 * which is also what the stock router does — they return above.
 */
file_put_contents(
    'php://stdout',
    sprintf(
        "[%s] %s:%s [%s] URI: %s\n",
        date('D M j H:i:s Y'),
        $_SERVER['REMOTE_ADDR'] ?? '-',
        $_SERVER['REMOTE_PORT'] ?? '-',
        $_SERVER['REQUEST_METHOD'] ?? '-',
        $uri,
    ),
);

require_once $frontController;
