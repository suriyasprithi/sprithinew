<?php
// Build favicon.ico (48x48, PNG-encoded) + icon.png (192) from the SPRITHI icon,
// and drop them into both Next apps' app/ dirs (App Router metadata files).
// Run: php make-favicon.php
$src = __DIR__ . '/sprithi-icon-512.png';
$base = imagecreatefrompng($src);
imagealphablending($base, true);

$resize = function ($size) use ($base) {
    $im = imagecreatetruecolor($size, $size);
    // white background (the tab icon sits on white; matches the logo plate)
    imagefill($im, 0, 0, imagecolorallocate($im, 255, 255, 255));
    imagecopyresampled($im, $base, 0, 0, 0, 0, $size, $size, imagesx($base), imagesy($base));
    return $im;
};

// --- favicon.ico: ICO container wrapping a 48x48 PNG (browsers read PNG icos) ---
$ico48 = $resize(48);
ob_start(); imagepng($ico48); $png48 = ob_get_clean();
$ico  = pack('vvv', 0, 1, 1);                                   // reserved, type=icon, count=1
$ico .= pack('CCCCvvVV', 48, 48, 0, 0, 1, 32, strlen($png48), 22);
$ico .= $png48;

// --- icon.png: 192 for crisp tabs / PWA ---
$icon192 = $resize(192);
ob_start(); imagepng($icon192); $png192 = ob_get_clean();

foreach (['customer-app', 'staff-app'] as $app) {
    $dir = dirname(__DIR__) . '/' . $app . '/app';
    file_put_contents($dir . '/favicon.ico', $ico);
    file_put_contents($dir . '/icon.png', $png192);
    echo "wrote $dir/favicon.ico (" . strlen($ico) . " B) + icon.png (" . strlen($png192) . " B)\n";
}
