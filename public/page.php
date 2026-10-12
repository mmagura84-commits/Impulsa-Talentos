<?php
/**
 * Serves the prerendered pages so the CDN keeps them for one minute, not a year.
 *
 * Hostinger sends "Cache-Control: max-age=31536000" on every static file, HTML
 * included, and ignores the .htaccess header rules; its CDN then holds each
 * page until someone flushes it by hand. Headers sent by PHP *are* honoured
 * (verified with /cdn-probe.php: the CDN reported our own Cache-Control and an
 * Age counting up to s-maxage). So page requests are routed here (.htaccess),
 * and this file hands back exactly the same prerendered HTML with:
 *   - s-maxage=60      the CDN serves its copy for at most a minute, then
 *                      re-asks this server: a deploy is live within a minute
 *                      with no cache flush;
 *   - max-age=0        browsers always re-ask (the HTML is tiny and compressed;
 *                      /assets are content-hashed and still cached for a year).
 * Nothing else changes: same bytes, same URLs. The service worker and the
 * self-update script in every page stay as the safety net.
 */
$root = __DIR__;
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if (!is_string($path) || $path === '') { $path = '/'; }
$path = rawurldecode($path);

// Only ever read a .html file from inside this folder.
$safe = $path !== '' && strpos($path, "\0") === false && strpos($path, '..') === false;
$file = null;
if ($safe) {
    $base = rtrim($root . '/' . trim(preg_replace('#/+#', '/', $path), '/'), '/');
    foreach ([$base . '/index.html', $base . '.html'] as $candidate) {
        $real = realpath($candidate);
        if ($real !== false && is_file($real) && strpos($real, $root . '/') === 0) { $file = $real; break; }
    }
}

$status = 200;
if ($file === null) {
    // Unknown path: the neutral app shell, which routes it in the browser
    // (same as the static setup did).
    $file = $root . '/spa-fallback.html';
    if (!is_file($file)) { http_response_code(500); exit; }
}

http_response_code($status);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=0, s-maxage=60');
header('Vary: Accept-Encoding');
header_remove('Expires');
header_remove('Pragma');
header('X-Impulsa-Page: php');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'HEAD') {
    header('Content-Length: ' . (string) filesize($file));
    exit;
}
readfile($file);
