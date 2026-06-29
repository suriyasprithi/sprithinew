<?php
// Third test: images live in SUBFOLDERS inside the ZIP (shirts/, soap/, misc/sub/).
// Matching is by filename only, so folders are organisational. Also tests a
// folder-path in the CSV cell (row 2) + SKU fallback to a deep subfolder (PEN).
// Run: php make-import-test3.php
$dir = __DIR__ . '/import-test-3';
@mkdir($dir . '/src', 0775, true);

$csv = <<<CSV
item_code,product_name,category,sku,color,price,stock,image,images
SHIRT,Cotton Shirt,Clothing,SHIRT-RED,Red,499,20,SHIRT_RED.jpg,
SHIRT,Cotton Shirt,Clothing,SHIRT-BLUE,Blue,499,15,shirts/SHIRT_BLUE.jpg,
SOAP,Lavender Soap,Personal Care,,,35,200,,SOAP1.jpg|SOAP2.jpg
PEN,Blue Pen,Stationery,,,10,500,,
BAG,Jute Bag,Accessories,,,150,25,BAG_MISSING.jpg,
CSV;
file_put_contents($dir . '/products-test3.csv', $csv);

$make = function (string $path, string $label, array $rgb): void {
    $im = imagecreatetruecolor(400, 400);
    imagefill($im, 0, 0, imagecolorallocate($im, $rgb[0], $rgb[1], $rgb[2]));
    imagestring($im, 5, 20, 190, $label, imagecolorallocate($im, 255, 255, 255));
    imagejpeg($im, $path, 85);
    imagedestroy($im);
};
// [zip entry path => [label, rgb]] — note the SUBFOLDERS in the entry path.
$entries = [
    'shirts/SHIRT_RED.jpg'  => ['Shirt Red',  [200, 50, 50]],
    'shirts/SHIRT_BLUE.jpg' => ['Shirt Blue', [50, 90, 200]],
    'soap/SOAP1.jpg'        => ['Soap front', [150, 110, 200]],
    'soap/SOAP2.jpg'        => ['Soap back',  [120, 80, 170]],
    'misc/sub/PEN.jpg'      => ['Pen (deep folder + SKU)', [40, 40, 120]],
];
$i = 0;
$tmpFiles = [];
foreach ($entries as $rgbLabel) { /* placeholder */ }
$zipPath = $dir . '/product-images-3.zip';
@unlink($zipPath);
$za = new ZipArchive();
$za->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);
foreach ($entries as $entryPath => [$label, $rgb]) {
    $tmp = $dir . '/src/' . ($i++) . '.jpg';
    $make($tmp, $label, $rgb);
    $za->addFile($tmp, $entryPath);   // entry keeps the folder path
    $tmpFiles[] = $tmp;
}
$za->close();
foreach ($tmpFiles as $f) @unlink($f);   // keep only the zip + csv
@rmdir($dir . '/src');

echo "CSV : $dir/products-test3.csv\n";
echo "ZIP : $zipPath (images inside shirts/ , soap/ , misc/sub/ ; BAG_MISSING.jpg left out)\n";
echo "Expect: 4 products, 2 variants. Row2 uses 'shirts/SHIRT_BLUE.jpg' path; PEN matched from misc/sub/ via SKU; 1 missing (BAG_MISSING.jpg)\n";
