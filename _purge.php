<?php
declare(strict_types=1);

// Consenti solo POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }

// Host fisso (non prenderlo dall'utente)
$host = 'tool.tibiona.it';

// PURGE locale verso SG/Varnish/Nginx cache
$cmd = 'curl -sS -X PURGE http://127.0.0.1/* -H '.escapeshellarg("Host: {$host}");
$out = shell_exec($cmd) ?: '';
echo $out;
