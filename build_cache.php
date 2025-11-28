<?php
require_once 'fetch_plytix_data.php';

$cacheDir = __DIR__ . '/cache';
echo "Building consolidated cache...\n";
buildConsolidatedCache($cacheDir);
echo "Done!\n";
?>
