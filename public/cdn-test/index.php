<?php
// Probe: does this host serve index.php ahead of index.html in a directory?
// If it does, the build can put one next to every page so the CDN keeps pages
// for a minute instead of a year (headers set by PHP are honoured here).
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=0, s-maxage=60');
header('X-Impulsa-Page: php');
echo '<!doctype html><title>cdn test</title><p>php index.php</p>';
