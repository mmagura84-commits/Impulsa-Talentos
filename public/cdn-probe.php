<?php
// CDN behaviour probe (no data, no input): does Hostinger's CDN honour
// cache headers sent by PHP? It asks for 60 s at the CDN, none in browsers.
// If repeated requests show the same "id" for about a minute, then a new one,
// page HTML can be served this way with a short CDN lifetime (no flush needed).
header('Content-Type: application/json');
header('Cache-Control: public, max-age=0, s-maxage=60');
echo json_encode(['id' => bin2hex(random_bytes(4)), 'at' => gmdate('c')]);
