<?php
// Second test set: 5 rows → 4 products. Covers colour variants (per-variant
// image), a multi-image gallery (images column, pipe-separated), SKU fallback,
// and a missing image. Run: php make-import-test2.php
$dir = __DIR__ . '/import-test-2';
@mkdir($dir, 0775, true);

$csv = <<<CSV
item_code,product_name,category,sku,color,price,stock,image,images
SHIRT,Cotton Shirt,Clothing,SHIRT-RED,Red,499,20,SHIRT_RED.jpg,
SHIRT,Cotton Shirt,Clothing,SHIRT-BLUE,Blue,499,15,SHIRT_BLUE.jpg,
SOAP,Lavender Soap,Personal Care,,,35,200,,SOAP1.jpg|SOAP2.jpg
PEN,Blue Pen,Stationery,,,10,500,,
BAG,Jute Bag,Accessories,,,150,25,BAG_MISSING.jpg,
CSV;
file_put_contents($dir . '/products-test2.csv', $csv);

$make = function (string $path, string $label, array $rgb): void {
    $im = imagecreatetruecolor(400, 400);
    imagefill($im, 0, 0, imagecolorallocate($im, $rgb[0], $rgb[1], $rgb[2]));
    $white = imagecolorallocate($im, 255, 255, 255);
    imagestring($im, 5, 20, 190, $label, $white);
    imagejpeg($im, $path, 85);
    imagedestroy($im);
};
$imgs = [
    'SHIRT_RED.jpg'  => ['Shirt Red',  [200, 50, 50]],
    'SHIRT_BLUE.jpg' => ['Shirt Blue', [50, 90, 200]],
    'SOAP1.jpg'      => ['Soap front', [150, 110, 200]],
    'SOAP2.jpg'      => ['Soap back',  [120, 80, 170]],
    'PEN.jpg'        => ['Pen (SKU match)', [40, 40, 120]],
];
foreach ($imgs as $name => [$label, $rgb]) $make($dir . '/' . $name, $label, $rgb);

$zipPath = $dir . '/product-images-2.zip';
@unlink($zipPath);
$za = new ZipArchive();
$za->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);
foreach (array_keys($imgs) as $name) $za->addFile($dir . '/' . $name, $name);
$za->close();

echo "CSV : $dir/products-test2.csv\n";
echo "ZIP : $zipPath (" . count($imgs) . " images; BAG_MISSING.jpg left out)\n";
echo "Expect: 4 products, 2 variants (Shirt Red/Blue); Soap 2-image gallery; Pen via SKU fallback; 1 missing (BAG_MISSING.jpg)\n";
