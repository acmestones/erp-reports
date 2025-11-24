<?php
$testFile = __DIR__ . '/test_write.txt';
if (file_put_contents($testFile, "test " . date('c')) !== false) {
    echo "Write successful: $testFile";
} else {
    echo "Write failed: $testFile";
}
