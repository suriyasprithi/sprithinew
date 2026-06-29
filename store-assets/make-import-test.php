<?php
// Generates a 5-row test CSV + a matching product-images ZIP for the catalog
// image-import. Run: php make-import-test.php
$dir = __DIR__ . '/import-test';
@mkdir($dir, 0775, true);

// --- CSV (5 rows): Rice = 2 size variants; Oil/Dal/Sugar = single products ---
// DAL row points at an image NOT in the ZIP (tests the "missing images" report).
// Sugar row has an EMPTY image cell (tests SKU fallback: zip has SUG.jpg).
$csv = <<<CSV
item_code,product_name,category,sku,size,price,stock,image
RICE,Rice,Grocery,RICE001,1 Kg,60,100,RICE001.jpg
RICE,Rice,Grocery,RICE005,5 Kg,280,50,RICE005.jpg
OIL,Sunflower Oil,Grocery,,,120,30,OIL001.jpg
DAL,Toor Dal,Grocery,,,90,40,DAL_MISSING.jpg
SUG,Sugar,Grocery,,,45,80,
CSV;
file_put_contents($dir . '/products-test.csv', $csv);

// --- Make 4 small labelled JPGs (the ones that SHOULD match) ---
$make = function (string $path, string $label, array $rgb): void {
    $im = imagecreatetruecolor(400, 400);
    imagefill($im, 0, 0, imagecolorallocate($im, $rgb[0], $rgb[1], $rgb[2]));
    $white = imagecolorallocate($im, 255, 255, 255);
    imagestring($im, 5, 20, 190, $label, $white);
    imagejpeg($im, $path, 85);
    imagedestroy($im);
};
$imgs = [
    'RICE001.jpg' => ['Rice 1 Kg', [60, 160, 80]],
    'RICE005.jpg' => ['Rice 5 Kg', [40, 120, 200]],
    'OIL001.jpg'  => ['Sunflower Oil', [230, 170, 30]],
    'SUG.jpg'     => ['Sugar (SKU match)', [180, 70, 160]],   // SKU-fallback for item_code SUG
];
foreach ($imgs as $name => [$label, $rgb]) $make($dir . '/' . $name, $label, $rgb);

// --- ZIP them (note: DAL_MISSING.jpg is intentionally NOT included) ---
$zipPath = $dir . '/product-images.zip';
@unlink($zipPath);
$za = new ZipArchive();
$za->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);
foreach (array_keys($imgs) as $name) $za->addFile($dir . '/' . $name, $name);
$za->close();

echo "CSV : $dir/products-test.csv\n";
echo "ZIP : $zipPath (" . count($imgs) . " images; DAL_MISSING.jpg left out on purpose)\n";
echo "Expect: 4 products, 2 variants; SUG via SKU fallback; 1 missing image (DAL_MISSING.jpg)\n";
