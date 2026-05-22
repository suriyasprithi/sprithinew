<?php

namespace App\Database\Seeds;

use App\Models\CategoryModel;
use App\Models\DistrictModel;
use App\Models\PincodeModel;
use App\Models\ProductModel;
use App\Models\ProductVariantModel;
use App\Models\StateModel;
use App\Models\TalukModel;
use App\Models\ReferralModel;
use App\Models\UserModel;
use App\Models\VendorCategoryModel;
use App\Models\VendorProfileModel;
use CodeIgniter\Database\Seeder;

/**
 * Dev convenience seeder: one user per role with predictable mobile numbers,
 * plus sample geo + categories + vendor profile + products so the shop page
 * has something to render. Idempotent.
 *
 * Usage: php spark db:seed DevSeeder
 *
 * Dev-only — bypasses the role hierarchy (admin/state/district/taluk create
 * each other via API in production). Do not run in production environments.
 *
 * All users share password = "change-me".
 */
class DevSeeder extends Seeder
{
    public function run()
    {
        $this->seedUsers();
        $this->seedGeo();
        $this->seedCategories();
        // Mock content disabled — DB should reflect real signups/uploads, not demo seed data.
        // Re-enable in dev when you need pre-filled fixtures.
        $this->seedVendorProfile();
        $this->seedExtraVendors();
        $this->seedProducts();
        $this->seedVariantProducts();
        $this->seedFullCatalogDemoProducts();
        $this->seedBakerySubCategories();
        $this->seedReferrals();
        echo "DevSeeder: done\n";
    }

    private function seedUsers(): void
    {
        $password = 'change-me';
        $hash     = password_hash($password, PASSWORD_BCRYPT);

        // Dev wallet seed — sized so the full token chain runs without
        // anyone hitting an "insufficient ₹" error. Token chain math:
        //   state pays nothing (base=0), district pays ₹2/tk, taluk ₹3/tk,
        //   vendor ₹4/tk. ₹10 000 per non-vendor lets each push 2 500+ tokens
        //   down; vendor gets ₹20 000 so they can absorb a real top-up too.
        $accounts = [
            ['mobile' => '9999000001', 'role' => 'admin',    'name' => 'Dev Admin',    'wallet' => 0],
            ['mobile' => '9999000002', 'role' => 'state',    'name' => 'Dev State',    'wallet' => 10000],
            ['mobile' => '9999000003', 'role' => 'district', 'name' => 'Dev District', 'wallet' => 10000],
            ['mobile' => '9999000004', 'role' => 'taluk',    'name' => 'Dev Taluk',    'wallet' => 10000],
            ['mobile' => '9999000005', 'role' => 'vendor',   'name' => 'Dev Vendor',   'wallet' => 20000],
            ['mobile' => '9999000006', 'role' => 'customer', 'name' => 'Dev Customer', 'wallet' => 5000],
        ];

        $users = new UserModel();
        foreach ($accounts as $a) {
            if ($users->mobileExistsForRole($a['mobile'], $a['role'])) {
                echo "Skip user (exists): {$a['mobile']} / {$a['role']}\n";
                continue;
            }
            $users->insert([
                'name'           => $a['name'],
                'mobile_number'  => $a['mobile'],
                'password_hash'  => $hash,
                'role'           => $a['role'],
                'status'         => 'active',
                'wallet_balance' => $a['wallet'],
            ]);
            echo "Created {$a['role']}: {$a['mobile']} / {$password}\n";
        }
    }

    private function seedGeo(): void
    {
        $states    = new StateModel();
        $districts = new DistrictModel();
        $taluks    = new TalukModel();
        $pincodes  = new PincodeModel();

        $stateId = $states->where('name', 'Tamil Nadu')->first()['id']
            ?? $states->insert(['name' => 'Tamil Nadu', 'status' => 'active'], true);

        $districtId = $districts->where('name', 'Coimbatore')->first()['id']
            ?? $districts->insert(['name' => 'Coimbatore', 'state_id' => $stateId, 'status' => 'active'], true);

        $talukId = $taluks->where('name', 'Coimbatore South')->first()['id']
            ?? $taluks->insert(['name' => 'Coimbatore South', 'district_id' => $districtId, 'status' => 'active'], true);

        foreach (['641001', '641002', '641011', '641012'] as $code) {
            if ($pincodes->where('code', $code)->first()) continue;
            $pincodes->insert(['code' => $code, 'district_id' => $districtId, 'taluk_id' => $talukId]);
        }
        echo "Geo: state/district/taluk/pincodes ready\n";
    }

    private function seedCategories(): void
    {
        $cats  = new CategoryModel();
        $vcats = new VendorCategoryModel();

        foreach ([
            ['name' => 'Grocery',     'commission_pct' => 3],
            ['name' => 'Apparel',     'commission_pct' => 5],
            ['name' => 'Electronics', 'commission_pct' => 4],
            ['name' => 'Home',        'commission_pct' => 4],
            ['name' => 'Mobiles',     'commission_pct' => 4],
            ['name' => 'Shoes',       'commission_pct' => 5],
        ] as $c) {
            if ($cats->where('name', $c['name'])->first()) continue;
            $cats->insert([
                'name'           => $c['name'],
                'commission_pct' => $c['commission_pct'],
                'status'         => 'active',
            ]);
        }

        if (! $vcats->where('name', 'Grocery store')->first()) {
            $vcats->insert(['name' => 'Grocery store', 'status' => 'active']);
        }

        // If an "Electronics Shop" vendor category exists (admin may have
        // created it via UI), link Mobiles + Shoes to it so vendors under that
        // shop type can pick them in their New Product dropdown.
        $electronicsShop = $vcats->where('name', 'Electronics Shop')->first();
        if ($electronicsShop) {
            $vcid = (int) $electronicsShop['id'];
            foreach (['Mobiles', 'Shoes'] as $name) {
                $row = $cats->where('name', $name)->first();
                if ($row && (int) ($row['vendor_category_id'] ?? 0) !== $vcid) {
                    $cats->update($row['id'], ['vendor_category_id' => $vcid]);
                }
            }
        }
        echo "Categories ready\n";
    }

    private function seedVendorProfile(): void
    {
        $users    = new UserModel();
        $profiles = new VendorProfileModel();
        $vendor   = $users->where('mobile_number', '9999000005')->where('role', 'vendor')->first();
        if (! $vendor) return;
        if ($profiles->find($vendor['id'])) {
            echo "Vendor profile exists for Dev Vendor\n";
            return;
        }

        $tnId       = (new StateModel())->where('name', 'Tamil Nadu')->first()['id'];
        $districtId = (new DistrictModel())->where('name', 'Coimbatore')->first()['id'];
        $talukId    = (new TalukModel())->where('name', 'Coimbatore South')->first()['id'];
        $vcatId     = (new VendorCategoryModel())->where('name', 'Grocery store')->first()['id'] ?? null;

        $profiles->insert([
            'user_id'            => $vendor['id'],
            'vendor_category_id' => $vcatId,
            'shop_name'          => 'Dev Grocery Store',
            'address'            => 'Town Hall, Coimbatore',
            'area'               => 'Town Hall',
            'state_id'           => $tnId,
            'district_id'        => $districtId,
            'taluk_id'           => $talukId,
            'pincode'            => '641001',
        ]);
        echo "Vendor profile created for Dev Vendor (shop: Dev Grocery Store)\n";
    }

    private function seedExtraVendors(): void
    {
        $users    = new UserModel();
        $profiles = new VendorProfileModel();

        $tnId       = (new StateModel())->where('name', 'Tamil Nadu')->first()['id'] ?? null;
        $districtId = (new DistrictModel())->where('name', 'Coimbatore')->first()['id'] ?? null;
        $talukId    = (new TalukModel())->where('name', 'Coimbatore South')->first()['id'] ?? null;
        $vcatId     = (new VendorCategoryModel())->where('name', 'Grocery store')->first()['id'] ?? null;

        $hash = password_hash('change-me', PASSWORD_BCRYPT);

        $shops = [
            ['mobile' => '9999000010', 'name' => 'Annapurna Stores', 'shop' => 'Annapurna Stores', 'pincode' => '641001'],
            ['mobile' => '9999000011', 'name' => 'Spice Bazaar',     'shop' => 'Spice Bazaar',     'pincode' => '641002'],
            ['mobile' => '9999000012', 'name' => 'Comfort Wear',     'shop' => 'Comfort Wear',     'pincode' => '641011'],
        ];

        foreach ($shops as $s) {
            $existing = $users->where('mobile_number', $s['mobile'])->where('role', 'vendor')->first();
            if ($existing) {
                $userId = (int) $existing['id'];
                echo "Skip vendor user (exists): {$s['mobile']}\n";
            } else {
                $userId = (int) $users->insert([
                    'name'          => $s['name'],
                    'mobile_number' => $s['mobile'],
                    'password_hash' => $hash,
                    'role'          => 'vendor',
                    'status'        => 'active',
                ], true);
                echo "Created vendor: {$s['mobile']} ({$s['shop']})\n";
            }

            if ($profiles->find($userId)) {
                echo "Skip vendor profile (exists): {$s['shop']}\n";
                continue;
            }
            $profiles->insert([
                'user_id'            => $userId,
                'vendor_category_id' => $vcatId,
                'shop_name'          => $s['shop'],
                'address'            => 'Coimbatore',
                'area'               => 'Coimbatore South',
                'state_id'           => $tnId,
                'district_id'        => $districtId,
                'taluk_id'           => $talukId,
                'pincode'            => $s['pincode'],
            ], false);
            echo "Vendor profile created: {$s['shop']}\n";
        }
    }

    private function seedProducts(): void
    {
        $users    = new UserModel();
        $cats     = new CategoryModel();
        $products = new ProductModel();
        $variants = new ProductVariantModel();

        $vendor = $users->where('mobile_number', '9999000005')->where('role', 'vendor')->first();
        if (! $vendor) return;
        $vendorId = (int) $vendor['id'];

        $catId = static fn (CategoryModel $cm, string $name): ?int => $cm->where('name', $name)->first()['id'] ?? null;

        $catalog = [
            ['cat' => 'Grocery',     'name' => 'Sona Masuri Rice 5kg',         'desc' => 'Premium short-grain rice.',     'price' => 380, 'stock' => 24, 'has_variants' => true,  'attrs' => ['weight_kg' => 5]],
            ['cat' => 'Grocery',     'name' => 'Cold-pressed Coconut Oil 1L',  'desc' => 'Wood-pressed virgin oil.',      'price' => 450, 'stock' => 12, 'has_variants' => false, 'attrs' => null],
            ['cat' => 'Grocery',     'name' => 'Organic Turmeric Powder 250g', 'desc' => 'Single-origin Erode turmeric.', 'price' => 95,  'stock' => 50, 'has_variants' => false, 'attrs' => ['weight_g' => 250]],
            ['cat' => 'Apparel',     'name' => 'Cotton T-shirt',               'desc' => 'Round neck, regular fit.',      'price' => 549, 'stock' => 30, 'has_variants' => true,  'attrs' => null],
            ['cat' => 'Electronics', 'name' => 'Smart LED Bulb 9W',            'desc' => 'Wi-Fi controlled, 16M colors.', 'price' => 699, 'stock' => 8,  'has_variants' => false, 'attrs' => null],
            ['cat' => 'Home',        'name' => 'Stainless Steel Lunch Box',    'desc' => 'Three-compartment, leakproof.', 'price' => 320, 'stock' => 45, 'has_variants' => false, 'attrs' => null],
        ];
        foreach ($catalog as $p) {
            if ($products->where('name', $p['name'])->first()) continue;
            $id = $products->insert([
                'vendor_id'    => $vendorId,
                'category_id'  => $catId($cats, $p['cat']),
                'name'         => $p['name'],
                'description'  => $p['desc'],
                'price'        => $p['price'],
                'stock'        => $p['stock'],
                'has_variants' => $p['has_variants'] ? 1 : 0,
                'attributes'   => $p['attrs'] ? json_encode($p['attrs']) : null,
                'status'       => 'active',
            ], true);
            echo "Product: {$p['name']}\n";

            if ($p['has_variants']) {
                if ($p['name'] === 'Sona Masuri Rice 5kg') {
                    $variants->insertBatch([
                        ['product_id' => $id, 'name' => '1 kg',  'price' => 80,  'stock' => 100, 'status' => 'active'],
                        ['product_id' => $id, 'name' => '5 kg',  'price' => 380, 'stock' => 24,  'status' => 'active'],
                        ['product_id' => $id, 'name' => '10 kg', 'price' => 740, 'stock' => 10,  'status' => 'active'],
                    ]);
                } elseif ($p['name'] === 'Cotton T-shirt') {
                    $variants->insertBatch([
                        ['product_id' => $id, 'name' => 'S',  'price' => 549, 'stock' => 8,  'status' => 'active'],
                        ['product_id' => $id, 'name' => 'M',  'price' => 549, 'stock' => 12, 'status' => 'active'],
                        ['product_id' => $id, 'name' => 'L',  'price' => 549, 'stock' => 6,  'status' => 'active'],
                        ['product_id' => $id, 'name' => 'XL', 'price' => 599, 'stock' => 4,  'status' => 'active'],
                    ]);
                }
            }
        }
    }

    /**
     * Two full-stack variant demo products: Redmi Note 14 + Nike Air Max.
     * Exercises products.variant_types, products.variant_images, and
     * product_variants rows (one per Cartesian combination).
     * Idempotent: skips re-insert if a product with the same name already exists.
     */
    private function seedVariantProducts(): void
    {
        $users    = new UserModel();
        $cats     = new CategoryModel();
        $products = new ProductModel();
        $variants = new ProductVariantModel();

        // Assign to "Comfort Wear" (9999000012) — closest of the seeded shops
        // for phones/shoes. Self-heal: if a previous run pinned these products
        // to a different vendor, move them here so the demo lines up.
        $vendor = $users->where('mobile_number', '9999000012')->where('role', 'vendor')->first();
        if (! $vendor) { echo "Variant products skipped: vendor not found\n"; return; }
        $vendorId = (int) $vendor['id'];

        foreach (['Redmi Note 14', 'Nike Air Max'] as $name) {
            $existing = $products->where('name', $name)->first();
            if ($existing && (int) $existing['vendor_id'] !== $vendorId) {
                $products->update($existing['id'], ['vendor_id' => $vendorId]);
                echo "Reassigned {$name} to Comfort Wear\n";
            }
        }

        $mobilesCatId = $cats->where('name', 'Mobiles')->first()['id'] ?? null;
        $shoesCatId   = $cats->where('name', 'Shoes')->first()['id']   ?? null;

        // Hosted placeholder images — color-coded so the swap is obvious.
        $img = static fn (string $bg, string $fg, string $label): string =>
            "https://placehold.co/600x600/{$bg}/{$fg}/png?text=" . rawurlencode($label);

        $allProducts = [
            [
                'name'           => 'Redmi Note 14',
                'description'    => 'AMOLED 6.67" · 200MP OIS camera · Dimensity 7400-Ultra · 5G · 5000mAh.',
                'category_id'    => $mobilesCatId,
                'sku_prefix'     => 'RM14',
                'image'          => $img('1a1a1a', 'ffffff', 'Redmi+Note+14'),
                'variant_types'  => [
                    ['name' => 'Color',   'options' => ['Black', 'Blue']],
                    ['name' => 'Storage', 'options' => ['6GB+128GB', '8GB+256GB']],
                ],
                'variant_images' => [
                    'Color' => [
                        'Black' => [
                            $img('1a1a1a', 'ffffff', 'Redmi+Black+Front'),
                            $img('111111', 'ffffff', 'Redmi+Black+Back'),
                        ],
                        'Blue' => [
                            $img('1e40af', 'ffffff', 'Redmi+Blue+Front'),
                            $img('1e3a8a', 'ffffff', 'Redmi+Blue+Back'),
                        ],
                    ],
                ],
                'combos' => [
                    ['opts' => ['Color' => 'Black', 'Storage' => '6GB+128GB'], 'sku' => 'RM14-BLK-6128', 'price' => 14999, 'stock' => 10],
                    ['opts' => ['Color' => 'Black', 'Storage' => '8GB+256GB'], 'sku' => 'RM14-BLK-8256', 'price' => 16999, 'stock' => 5],
                    ['opts' => ['Color' => 'Blue',  'Storage' => '6GB+128GB'], 'sku' => 'RM14-BLU-6128', 'price' => 15499, 'stock' => 8],
                    ['opts' => ['Color' => 'Blue',  'Storage' => '8GB+256GB'], 'sku' => 'RM14-BLU-8256', 'price' => 17499, 'stock' => 4],
                ],
            ],
            [
                'name'           => 'Nike Air Max',
                'description'    => 'Lifestyle sneaker with Max Air heel and breathable mesh upper.',
                'category_id'    => $shoesCatId,
                'sku_prefix'     => 'NK',
                'image'          => $img('f5f5f5', '111111', 'Nike+Air+Max'),
                'variant_types'  => [
                    ['name' => 'Color', 'options' => ['White', 'Red', 'Black']],
                    ['name' => 'Size',  'options' => ['7', '8', '9']],
                ],
                'variant_images' => [
                    'Color' => [
                        'White' => [
                            $img('f5f5f5', '111111', 'Nike+White+Side'),
                            $img('e5e5e5', '111111', 'Nike+White+Top'),
                        ],
                        'Red' => [
                            $img('dc2626', 'ffffff', 'Nike+Red+Side'),
                            $img('b91c1c', 'ffffff', 'Nike+Red+Top'),
                        ],
                        'Black' => [
                            $img('1a1a1a', 'ffffff', 'Nike+Black+Side'),
                            $img('0a0a0a', 'ffffff', 'Nike+Black+Top'),
                        ],
                    ],
                ],
                'combos' => [
                    ['opts' => ['Color' => 'White', 'Size' => '7'], 'sku' => 'NK-WHT-7', 'price' => 4999, 'stock' => 12],
                    ['opts' => ['Color' => 'White', 'Size' => '8'], 'sku' => 'NK-WHT-8', 'price' => 4999, 'stock' => 10],
                    ['opts' => ['Color' => 'White', 'Size' => '9'], 'sku' => 'NK-WHT-9', 'price' => 4999, 'stock' => 6],
                    ['opts' => ['Color' => 'Red',   'Size' => '7'], 'sku' => 'NK-RED-7', 'price' => 5499, 'stock' => 5],
                    ['opts' => ['Color' => 'Red',   'Size' => '8'], 'sku' => 'NK-RED-8', 'price' => 5499, 'stock' => 8],
                    ['opts' => ['Color' => 'Red',   'Size' => '9'], 'sku' => 'NK-RED-9', 'price' => 5499, 'stock' => 3],
                    ['opts' => ['Color' => 'Black', 'Size' => '7'], 'sku' => 'NK-BLK-7', 'price' => 5299, 'stock' => 0], // out of stock demo
                    ['opts' => ['Color' => 'Black', 'Size' => '8'], 'sku' => 'NK-BLK-8', 'price' => 5299, 'stock' => 15],
                    ['opts' => ['Color' => 'Black', 'Size' => '9'], 'sku' => 'NK-BLK-9', 'price' => 5299, 'stock' => 7],
                ],
            ],
        ];

        foreach ($allProducts as $p) {
            if ($products->where('name', $p['name'])->first()) {
                echo "Skip variant product (exists): {$p['name']}\n";
                continue;
            }
            $totalStock = array_sum(array_column($p['combos'], 'stock'));
            $minPrice   = min(array_column($p['combos'], 'price'));

            $productId = (int) $products->insert([
                'vendor_id'      => $vendorId,
                'category_id'    => $p['category_id'],
                'name'           => $p['name'],
                'description'    => $p['description'],
                'price'          => $minPrice,
                'stock'          => $totalStock,
                'has_variants'   => 1,
                'variant_types'  => json_encode($p['variant_types'], JSON_UNESCAPED_UNICODE),
                'variant_images' => json_encode($p['variant_images'], JSON_UNESCAPED_UNICODE),
                'image'          => $p['image'],
                'status'         => 'active',
            ], true);
            echo "Variant product: {$p['name']} (id={$productId}, {$totalStock} units total)\n";

            foreach ($p['combos'] as $c) {
                $name = implode(' + ', array_values($c['opts']));
                $variants->insert([
                    'product_id' => $productId,
                    'name'       => $name,
                    'sku'        => $c['sku'],
                    'options'    => json_encode($c['opts'], JSON_UNESCAPED_UNICODE),
                    'price'      => $c['price'],
                    'stock'      => $c['stock'],
                    'image'      => null,
                    'status'     => 'active',
                ], false);
            }
            echo "  → " . count($p['combos']) . " variant rows inserted\n";
        }
    }

    /**
     * Broad demo across every vendor category: 2 products per shop type with
     * full variant_types / variant_images / product_variants. Creates missing
     * vendors + product categories as needed. Idempotent — re-run is safe.
     */
    private function seedFullCatalogDemoProducts(): void
    {
        $users    = new UserModel();
        $cats     = new CategoryModel();
        $vcats    = new VendorCategoryModel();
        $profiles = new VendorProfileModel();
        $products = new ProductModel();
        $variants = new ProductVariantModel();

        $tnId       = (new StateModel())->where('name', 'Tamil Nadu')->first()['id']    ?? null;
        $districtId = (new DistrictModel())->where('name', 'Coimbatore')->first()['id'] ?? null;
        $talukId    = (new TalukModel())->where('name', 'Coimbatore South')->first()['id'] ?? null;
        $hash       = password_hash('change-me', PASSWORD_BCRYPT);

        $img = static fn (string $bg, string $fg, string $label): string =>
            "https://placehold.co/600x600/{$bg}/{$fg}/png?text=" . rawurlencode($label);

        // ===== Vendors: ensure one per vendor_category that needs a demo seller =====
        $vendorPlan = [
            ['mobile' => '9999000010', 'name' => 'Annapurna Stores',      'shop' => 'Annapurna Stores',     'vcat' => 'Grocery Store',      'pincode' => '641001'],
            ['mobile' => '9999000012', 'name' => 'Comfort Wear',          'shop' => 'Comfort Wear',         'vcat' => 'Electronics Shop',   'pincode' => '641011'],
            ['mobile' => '9999000020', 'name' => 'HealthFirst Pharmacy',  'shop' => 'HealthFirst Pharmacy', 'vcat' => 'Pharmacy',           'pincode' => '641001'],
            ['mobile' => '9999000021', 'name' => 'Sweet Crumb Bakery',    'shop' => 'Sweet Crumb Bakery',   'vcat' => 'Bakery',             'pincode' => '641002'],
            ['mobile' => '9999000022', 'name' => 'Spice Junction',        'shop' => 'Spice Junction',       'vcat' => 'Restaurant',         'pincode' => '641002'],
            ['mobile' => '9999000023', 'name' => 'Style Haven',           'shop' => 'Style Haven',          'vcat' => 'Fashion & Clothing', 'pincode' => '641011'],
            ['mobile' => '9999000024', 'name' => 'Prime Properties',      'shop' => 'Prime Properties',     'vcat' => 'Realestate',         'pincode' => '641012'],
        ];
        $vendorIdByMobile = [];
        foreach ($vendorPlan as $v) {
            $vc = $vcats->where('name', $v['vcat'])->first();
            if (! $vc) continue;
            $existing = $users->where('mobile_number', $v['mobile'])->where('role', 'vendor')->first();
            if ($existing) {
                $userId = (int) $existing['id'];
            } else {
                $userId = (int) $users->insert([
                    'name'          => $v['name'],
                    'mobile_number' => $v['mobile'],
                    'password_hash' => $hash,
                    'role'          => 'vendor',
                    'status'        => 'active',
                ], true);
                echo "Created vendor: {$v['mobile']} ({$v['shop']})\n";
            }
            // Profile: insert if missing, otherwise heal the vendor_category_id.
            $prof = $profiles->find($userId);
            if (! $prof) {
                $profiles->insert([
                    'user_id'            => $userId,
                    'vendor_category_id' => (int) $vc['id'],
                    'shop_name'          => $v['shop'],
                    'address'            => 'Coimbatore',
                    'area'               => 'Coimbatore South',
                    'state_id'           => $tnId,
                    'district_id'        => $districtId,
                    'taluk_id'           => $talukId,
                    'pincode'            => $v['pincode'],
                ], false);
            } elseif ((int) ($prof['vendor_category_id'] ?? 0) !== (int) $vc['id']) {
                $profiles->update($userId, ['vendor_category_id' => (int) $vc['id']]);
            }
            $vendorIdByMobile[$v['mobile']] = $userId;
        }

        // ===== Product categories: one per vendor_category =====
        $catPlan = [
            ['name' => 'Grocery',          'commission' => 3, 'vcat' => 'Grocery Store'],
            ['name' => 'Mobiles',          'commission' => 4, 'vcat' => 'Electronics Shop'],
            ['name' => 'Medicines',        'commission' => 4, 'vcat' => 'Pharmacy'],
            ['name' => 'Bakery Items',     'commission' => 5, 'vcat' => 'Bakery'],
            ['name' => 'Restaurant Food',  'commission' => 6, 'vcat' => 'Restaurant'],
            ['name' => 'Clothing',         'commission' => 6, 'vcat' => 'Fashion & Clothing'],
            ['name' => 'Properties',       'commission' => 2, 'vcat' => 'Realestate'],
        ];
        $catIdByName = [];
        foreach ($catPlan as $pc) {
            $vc = $vcats->where('name', $pc['vcat'])->first();
            if (! $vc) continue;
            $row = $cats->where('name', $pc['name'])->first();
            if ($row) {
                $catIdByName[$pc['name']] = (int) $row['id'];
                if ((int) ($row['vendor_category_id'] ?? 0) !== (int) $vc['id']) {
                    $cats->update($row['id'], ['vendor_category_id' => (int) $vc['id']]);
                }
            } else {
                $catIdByName[$pc['name']] = (int) $cats->insert([
                    'name'               => $pc['name'],
                    'commission_pct'     => $pc['commission'],
                    'vendor_category_id' => (int) $vc['id'],
                    'status'             => 'active',
                ], true);
            }
        }

        // ===== The 14 demo products =====
        $catalog = [
            // ---- Grocery Store ----
            [
                'vendor' => '9999000010', 'category' => 'Grocery',
                'name' => 'Aashirvaad Rice 25KG',
                'description' => 'Premium whole wheat aashirvaad rice — daily-staple quality at family-pack value.',
                'image' => $img('15803d', 'ffffff', 'Aashirvaad+Rice'),
                'variant_types' => [['name' => 'Weight', 'options' => ['5KG', '10KG', '25KG']]],
                'variant_images' => ['Weight' => [
                    '5KG'  => [$img('a3e635', '14532d', 'Rice+5KG'),  $img('86efac', '14532d', 'Rice+5KG+Back')],
                    '10KG' => [$img('86efac', '14532d', 'Rice+10KG'), $img('4ade80', '14532d', 'Rice+10KG+Back')],
                    '25KG' => [$img('4ade80', '14532d', 'Rice+25KG'), $img('22c55e', 'ffffff', 'Rice+25KG+Back')],
                ]],
                'combos' => [
                    ['opts' => ['Weight' => '5KG'],  'sku' => 'AASH-5KG',  'price' => 450,  'stock' => 30],
                    ['opts' => ['Weight' => '10KG'], 'sku' => 'AASH-10KG', 'price' => 850,  'stock' => 15],
                    ['opts' => ['Weight' => '25KG'], 'sku' => 'AASH-25KG', 'price' => 2100, 'stock' => 8],
                ],
            ],
            [
                'vendor' => '9999000010', 'category' => 'Grocery',
                'name' => 'Sunflower Cooking Oil 5L',
                'description' => 'Cold-pressed, refined sunflower oil. Light on the heart, perfect for daily cooking.',
                'image' => $img('eab308', '422006', 'Sunflower+Oil'),
                'variant_types' => [['name' => 'Pack Size', 'options' => ['1L', '2L', '5L']]],
                'variant_images' => ['Pack Size' => [
                    '1L' => [$img('facc15', '422006', 'Oil+1L'), $img('eab308', '422006', 'Oil+1L+Back')],
                    '2L' => [$img('ca8a04', '422006', 'Oil+2L'), $img('a16207', 'ffffff', 'Oil+2L+Back')],
                    '5L' => [$img('854d0e', 'ffffff', 'Oil+5L'), $img('713f12', 'ffffff', 'Oil+5L+Back')],
                ]],
                'combos' => [
                    ['opts' => ['Pack Size' => '1L'], 'sku' => 'SUNF-1L', 'price' => 180, 'stock' => 50],
                    ['opts' => ['Pack Size' => '2L'], 'sku' => 'SUNF-2L', 'price' => 350, 'stock' => 25],
                    ['opts' => ['Pack Size' => '5L'], 'sku' => 'SUNF-5L', 'price' => 850, 'stock' => 12],
                ],
            ],
            // ---- Electronics Shop (Redmi already seeded; add Boat) ----
            [
                'vendor' => '9999000012', 'category' => 'Mobiles',
                'name' => 'Boat Airdopes 141',
                'description' => 'TWS earbuds · 42hr playback · ENx noise cancellation · IPX4 sweat-resistant.',
                'image' => $img('111111', 'ffffff', 'Boat+Airdopes'),
                'variant_types' => [['name' => 'Color', 'options' => ['Black', 'White', 'Blue']]],
                'variant_images' => ['Color' => [
                    'Black' => [$img('1a1a1a', 'ffffff', 'Boat+Black'),  $img('111111', 'ffffff', 'Boat+Black+Case')],
                    'White' => [$img('f5f5f5', '111111', 'Boat+White'),  $img('e5e5e5', '111111', 'Boat+White+Case')],
                    'Blue'  => [$img('1e40af', 'ffffff', 'Boat+Blue'),   $img('1e3a8a', 'ffffff', 'Boat+Blue+Case')],
                ]],
                'combos' => [
                    ['opts' => ['Color' => 'Black'], 'sku' => 'BOAT141-BLK', 'price' => 1299, 'stock' => 25],
                    ['opts' => ['Color' => 'White'], 'sku' => 'BOAT141-WHT', 'price' => 1299, 'stock' => 15],
                    ['opts' => ['Color' => 'Blue'],  'sku' => 'BOAT141-BLU', 'price' => 1399, 'stock' => 8],
                ],
            ],
            // ---- Pharmacy ----
            [
                'vendor' => '9999000020', 'category' => 'Medicines',
                'name' => 'Paracetamol 500mg Tablets',
                'description' => 'Fever and pain relief. Take only as directed. Keep out of reach of children.',
                'image' => $img('3b82f6', 'ffffff', 'Paracetamol'),
                'variant_types' => [['name' => 'Pack', 'options' => ['10 Tablets', '20 Tablets', 'Bottle Pack']]],
                'variant_images' => ['Pack' => [
                    '10 Tablets'  => [$img('60a5fa', 'ffffff', 'Para+10T'),  $img('3b82f6', 'ffffff', 'Para+10T+Back')],
                    '20 Tablets'  => [$img('2563eb', 'ffffff', 'Para+20T'),  $img('1d4ed8', 'ffffff', 'Para+20T+Back')],
                    'Bottle Pack' => [$img('1e40af', 'ffffff', 'Para+Bottle'), $img('1e3a8a', 'ffffff', 'Para+Bottle+Back')],
                ]],
                'combos' => [
                    ['opts' => ['Pack' => '10 Tablets'],  'sku' => 'PARA-10T',     'price' => 25,  'stock' => 100],
                    ['opts' => ['Pack' => '20 Tablets'],  'sku' => 'PARA-20T',     'price' => 45,  'stock' => 80],
                    ['opts' => ['Pack' => 'Bottle Pack'], 'sku' => 'PARA-BOTTLE', 'price' => 120, 'stock' => 30],
                ],
            ],
            [
                'vendor' => '9999000020', 'category' => 'Medicines',
                'name' => 'Vitamin C 500mg Capsules',
                'description' => 'Immunity booster with natural amla extract. Best after meals.',
                'image' => $img('f97316', 'ffffff', 'Vitamin+C'),
                'variant_types' => [['name' => 'Pack', 'options' => ['30 Caps', '60 Caps', '120 Caps']]],
                'variant_images' => ['Pack' => [
                    '30 Caps'  => [$img('fdba74', '7c2d12', 'VitC+30'),  $img('fb923c', '7c2d12', 'VitC+30+Back')],
                    '60 Caps'  => [$img('f97316', 'ffffff', 'VitC+60'),  $img('ea580c', 'ffffff', 'VitC+60+Back')],
                    '120 Caps' => [$img('c2410c', 'ffffff', 'VitC+120'), $img('9a3412', 'ffffff', 'VitC+120+Back')],
                ]],
                'combos' => [
                    ['opts' => ['Pack' => '30 Caps'],  'sku' => 'VITC-30',  'price' => 150, 'stock' => 50],
                    ['opts' => ['Pack' => '60 Caps'],  'sku' => 'VITC-60',  'price' => 280, 'stock' => 25],
                    ['opts' => ['Pack' => '120 Caps'], 'sku' => 'VITC-120', 'price' => 520, 'stock' => 12],
                ],
            ],
            // ---- Bakery ----
            [
                'vendor' => '9999000021', 'category' => 'Bakery Items',
                'name' => 'Chocolate Truffle Cake',
                'description' => 'Three-layer chocolate truffle, rich ganache topping. Available eggless on request.',
                'image' => $img('78350f', 'ffffff', 'Chocolate+Cake'),
                'variant_types' => [['name' => 'Size', 'options' => ['500GM', '1KG', '2KG']]],
                'variant_images' => ['Size' => [
                    '500GM' => [$img('92400e', 'ffffff', 'Cake+500GM'), $img('78350f', 'ffffff', 'Cake+500GM+Slice')],
                    '1KG'   => [$img('a16207', 'ffffff', 'Cake+1KG'),   $img('854d0e', 'ffffff', 'Cake+1KG+Slice')],
                    '2KG'   => [$img('713f12', 'ffffff', 'Cake+2KG'),   $img('422006', 'ffffff', 'Cake+2KG+Slice')],
                ]],
                'combos' => [
                    ['opts' => ['Size' => '500GM'], 'sku' => 'CHOC-500', 'price' => 350,  'stock' => 5],
                    ['opts' => ['Size' => '1KG'],   'sku' => 'CHOC-1K',  'price' => 650,  'stock' => 3],
                    ['opts' => ['Size' => '2KG'],   'sku' => 'CHOC-2K',  'price' => 1200, 'stock' => 2],
                ],
            ],
            [
                'vendor' => '9999000021', 'category' => 'Bakery Items',
                'name' => 'Cheese Garlic Bread',
                'description' => 'Crusty sourdough loaded with mozzarella, herb butter, and roasted garlic.',
                'image' => $img('ca8a04', '422006', 'Garlic+Bread'),
                'variant_types' => [['name' => 'Size', 'options' => ['Small', 'Medium', 'Large']]],
                'variant_images' => ['Size' => [
                    'Small'  => [$img('facc15', '422006', 'Bread+S'), $img('eab308', '422006', 'Bread+S+Bite')],
                    'Medium' => [$img('ca8a04', '422006', 'Bread+M'), $img('a16207', 'ffffff', 'Bread+M+Bite')],
                    'Large'  => [$img('854d0e', 'ffffff', 'Bread+L'), $img('713f12', 'ffffff', 'Bread+L+Bite')],
                ]],
                'combos' => [
                    ['opts' => ['Size' => 'Small'],  'sku' => 'GBRD-S', 'price' => 80,  'stock' => 20],
                    ['opts' => ['Size' => 'Medium'], 'sku' => 'GBRD-M', 'price' => 120, 'stock' => 15],
                    ['opts' => ['Size' => 'Large'],  'sku' => 'GBRD-L', 'price' => 180, 'stock' => 10],
                ],
            ],
            // ---- Restaurant ----
            [
                'vendor' => '9999000022', 'category' => 'Restaurant Food',
                'name' => 'Hyderabadi Chicken Biryani',
                'description' => 'Long-grain basmati, slow-cooked with marinated chicken, saffron, and fried onions.',
                'image' => $img('b91c1c', 'fef3c7', 'Chicken+Biryani'),
                'variant_types' => [
                    ['name' => 'Size',  'options' => ['Regular', 'Medium', 'Large']],
                    ['name' => 'Spice', 'options' => ['Mild', 'Medium', 'Hot']],
                ],
                'variant_images' => ['Size' => [
                    'Regular' => [$img('f59e0b', '422006', 'Biryani+Reg'),  $img('d97706', 'ffffff', 'Biryani+Reg+Side')],
                    'Medium'  => [$img('b45309', 'ffffff', 'Biryani+Med'), $img('92400e', 'ffffff', 'Biryani+Med+Side')],
                    'Large'   => [$img('78350f', 'ffffff', 'Biryani+Lrg'), $img('451a03', 'ffffff', 'Biryani+Lrg+Side')],
                ]],
                'combos' => [
                    ['opts' => ['Size' => 'Regular', 'Spice' => 'Mild'],   'sku' => 'BIRY-R-MILD', 'price' => 180, 'stock' => 10],
                    ['opts' => ['Size' => 'Regular', 'Spice' => 'Medium'], 'sku' => 'BIRY-R-MED',  'price' => 180, 'stock' => 12],
                    ['opts' => ['Size' => 'Regular', 'Spice' => 'Hot'],    'sku' => 'BIRY-R-HOT',  'price' => 180, 'stock' => 8],
                    ['opts' => ['Size' => 'Medium',  'Spice' => 'Mild'],   'sku' => 'BIRY-M-MILD', 'price' => 230, 'stock' => 6],
                    ['opts' => ['Size' => 'Medium',  'Spice' => 'Medium'], 'sku' => 'BIRY-M-MED',  'price' => 230, 'stock' => 10],
                    ['opts' => ['Size' => 'Medium',  'Spice' => 'Hot'],    'sku' => 'BIRY-M-HOT',  'price' => 230, 'stock' => 5],
                    ['opts' => ['Size' => 'Large',   'Spice' => 'Mild'],   'sku' => 'BIRY-L-MILD', 'price' => 290, 'stock' => 3],
                    ['opts' => ['Size' => 'Large',   'Spice' => 'Medium'], 'sku' => 'BIRY-L-MED',  'price' => 290, 'stock' => 4],
                    ['opts' => ['Size' => 'Large',   'Spice' => 'Hot'],    'sku' => 'BIRY-L-HOT',  'price' => 290, 'stock' => 0],
                ],
            ],
            [
                'vendor' => '9999000022', 'category' => 'Restaurant Food',
                'name' => 'Margherita Veg Pizza',
                'description' => 'Hand-tossed thin-crust pizza with San Marzano tomato sauce, mozzarella, and basil.',
                'image' => $img('dc2626', 'fef3c7', 'Veg+Pizza'),
                'variant_types' => [['name' => 'Size', 'options' => ['Small', 'Medium', 'Large']]],
                'variant_images' => ['Size' => [
                    'Small'  => [$img('ef4444', 'fef3c7', 'Pizza+S'), $img('dc2626', 'fef3c7', 'Pizza+S+Top')],
                    'Medium' => [$img('b91c1c', 'fef3c7', 'Pizza+M'), $img('991b1b', 'fef3c7', 'Pizza+M+Top')],
                    'Large'  => [$img('7f1d1d', 'fef3c7', 'Pizza+L'), $img('450a0a', 'fef3c7', 'Pizza+L+Top')],
                ]],
                'combos' => [
                    ['opts' => ['Size' => 'Small'],  'sku' => 'VPIZ-S', 'price' => 199, 'stock' => 15],
                    ['opts' => ['Size' => 'Medium'], 'sku' => 'VPIZ-M', 'price' => 299, 'stock' => 10],
                    ['opts' => ['Size' => 'Large'],  'sku' => 'VPIZ-L', 'price' => 449, 'stock' => 5],
                ],
            ],
            // ---- Fashion & Clothing ----
            [
                'vendor' => '9999000023', 'category' => 'Clothing',
                'name' => "Men's Hoodie — Cotton Blend",
                'description' => 'Heavyweight 300 GSM cotton-fleece hoodie. Kangaroo pocket, adjustable drawstring.',
                'image' => $img('1f2937', 'ffffff', 'Mens+Hoodie'),
                'variant_types' => [
                    ['name' => 'Color', 'options' => ['Black', 'Grey', 'Navy']],
                    ['name' => 'Size',  'options' => ['S', 'M', 'L', 'XL']],
                ],
                'variant_images' => ['Color' => [
                    'Black' => [$img('1a1a1a', 'ffffff', 'Hoodie+Black+Front'), $img('111111', 'ffffff', 'Hoodie+Black+Back')],
                    'Grey'  => [$img('6b7280', 'ffffff', 'Hoodie+Grey+Front'),  $img('4b5563', 'ffffff', 'Hoodie+Grey+Back')],
                    'Navy'  => [$img('1e3a8a', 'ffffff', 'Hoodie+Navy+Front'),  $img('1e40af', 'ffffff', 'Hoodie+Navy+Back')],
                ]],
                'combos' => array_merge(...array_map(static function ($c) {
                    return array_map(static function ($s) use ($c) {
                        $colorCode = ['Black' => 'BLK', 'Grey' => 'GRY', 'Navy' => 'NVY'][$c];
                        $stocks    = ['S' => 12, 'M' => 18, 'L' => 14, 'XL' => 8];
                        return ['opts' => ['Color' => $c, 'Size' => $s], 'sku' => "HOOD-{$colorCode}-{$s}", 'price' => 999, 'stock' => $stocks[$s]];
                    }, ['S', 'M', 'L', 'XL']);
                }, ['Black', 'Grey', 'Navy'])),
            ],
            [
                'vendor' => '9999000023', 'category' => 'Clothing',
                'name' => "Women's Kurti — A-Line",
                'description' => 'Rayon A-line kurti with embroidered yoke. Pairs with leggings, palazzos, or jeans.',
                'image' => $img('be185d', 'ffffff', 'Womens+Kurti'),
                'variant_types' => [
                    ['name' => 'Color', 'options' => ['Red', 'Pink', 'Yellow']],
                    ['name' => 'Size',  'options' => ['S', 'M', 'L', 'XL']],
                ],
                'variant_images' => ['Color' => [
                    'Red'    => [$img('dc2626', 'ffffff', 'Kurti+Red+Front'),    $img('b91c1c', 'ffffff', 'Kurti+Red+Back')],
                    'Pink'   => [$img('ec4899', 'ffffff', 'Kurti+Pink+Front'),   $img('db2777', 'ffffff', 'Kurti+Pink+Back')],
                    'Yellow' => [$img('eab308', '422006', 'Kurti+Yellow+Front'), $img('ca8a04', '422006', 'Kurti+Yellow+Back')],
                ]],
                'combos' => array_merge(...array_map(static function ($c) {
                    return array_map(static function ($s) use ($c) {
                        $colorCode = ['Red' => 'RED', 'Pink' => 'PNK', 'Yellow' => 'YLW'][$c];
                        $stocks    = ['S' => 10, 'M' => 15, 'L' => 12, 'XL' => 6];
                        return ['opts' => ['Color' => $c, 'Size' => $s], 'sku' => "KURT-{$colorCode}-{$s}", 'price' => 599, 'stock' => $stocks[$s]];
                    }, ['S', 'M', 'L', 'XL']);
                }, ['Red', 'Pink', 'Yellow'])),
            ],
            // ---- Realestate ----
            [
                'vendor' => '9999000024', 'category' => 'Properties',
                'name' => '2BHK Apartment — Race Course',
                'description' => 'East-facing, gated community, 24/7 security. Walking distance to schools and metro.',
                'image' => $img('64748b', 'ffffff', '2BHK+Apartment'),
                'variant_types' => [
                    ['name' => 'Area',       'options' => ['1200 SQFT', '1500 SQFT']],
                    ['name' => 'Furnishing', 'options' => ['Unfurnished', 'Semi-furnished', 'Fully Furnished']],
                ],
                'variant_images' => ['Area' => [
                    '1200 SQFT' => [$img('94a3b8', 'ffffff', '2BHK+1200+Living'), $img('64748b', 'ffffff', '2BHK+1200+Floor')],
                    '1500 SQFT' => [$img('475569', 'ffffff', '2BHK+1500+Living'), $img('334155', 'ffffff', '2BHK+1500+Floor')],
                ]],
                'combos' => [
                    ['opts' => ['Area' => '1200 SQFT', 'Furnishing' => 'Unfurnished'],    'sku' => 'APT2-1200-UF', 'price' => 4500000, 'stock' => 2],
                    ['opts' => ['Area' => '1200 SQFT', 'Furnishing' => 'Semi-furnished'], 'sku' => 'APT2-1200-SF', 'price' => 5200000, 'stock' => 1],
                    ['opts' => ['Area' => '1200 SQFT', 'Furnishing' => 'Fully Furnished'],'sku' => 'APT2-1200-FF', 'price' => 6000000, 'stock' => 1],
                    ['opts' => ['Area' => '1500 SQFT', 'Furnishing' => 'Unfurnished'],    'sku' => 'APT2-1500-UF', 'price' => 6500000, 'stock' => 2],
                    ['opts' => ['Area' => '1500 SQFT', 'Furnishing' => 'Semi-furnished'], 'sku' => 'APT2-1500-SF', 'price' => 7500000, 'stock' => 1],
                    ['opts' => ['Area' => '1500 SQFT', 'Furnishing' => 'Fully Furnished'],'sku' => 'APT2-1500-FF', 'price' => 8500000, 'stock' => 1],
                ],
            ],
            [
                'vendor' => '9999000024', 'category' => 'Properties',
                'name' => 'Residential Plot — Kovai',
                'description' => 'Clear title, DTCP-approved layout. Corner plot premium adds 15%.',
                'image' => $img('854d0e', 'ffffff', 'Residential+Plot'),
                'variant_types' => [['name' => 'Area', 'options' => ['1200 SQFT', '2400 SQFT', '4800 SQFT']]],
                'variant_images' => ['Area' => [
                    '1200 SQFT' => [$img('a3a3a3', 'ffffff', 'Plot+1200+Aerial'), $img('737373', 'ffffff', 'Plot+1200+Map')],
                    '2400 SQFT' => [$img('737373', 'ffffff', 'Plot+2400+Aerial'), $img('525252', 'ffffff', 'Plot+2400+Map')],
                    '4800 SQFT' => [$img('525252', 'ffffff', 'Plot+4800+Aerial'), $img('404040', 'ffffff', 'Plot+4800+Map')],
                ]],
                'combos' => [
                    ['opts' => ['Area' => '1200 SQFT'], 'sku' => 'PLOT-1200', 'price' => 2500000, 'stock' => 3],
                    ['opts' => ['Area' => '2400 SQFT'], 'sku' => 'PLOT-2400', 'price' => 4800000, 'stock' => 2],
                    ['opts' => ['Area' => '4800 SQFT'], 'sku' => 'PLOT-4800', 'price' => 9000000, 'stock' => 1],
                ],
            ],
        ];

        foreach ($catalog as $p) {
            if ($products->where('name', $p['name'])->first()) {
                echo "Skip product (exists): {$p['name']}\n";
                continue;
            }
            $vendorId = $vendorIdByMobile[$p['vendor']] ?? null;
            $catId    = $catIdByName[$p['category']]   ?? null;
            if (! $vendorId || ! $catId) {
                echo "Skip product (missing vendor/category): {$p['name']}\n";
                continue;
            }
            $totalStock = array_sum(array_column($p['combos'], 'stock'));
            $minPrice   = min(array_column($p['combos'], 'price'));
            $productId  = (int) $products->insert([
                'vendor_id'      => $vendorId,
                'category_id'    => $catId,
                'name'           => $p['name'],
                'description'    => $p['description'],
                'price'          => $minPrice,
                'stock'          => $totalStock,
                'has_variants'   => 1,
                'variant_types'  => json_encode($p['variant_types'], JSON_UNESCAPED_UNICODE),
                'variant_images' => json_encode($p['variant_images'], JSON_UNESCAPED_UNICODE),
                'image'          => $p['image'],
                'status'         => 'active',
            ], true);
            foreach ($p['combos'] as $c) {
                $variants->insert([
                    'product_id' => $productId,
                    'name'       => implode(' + ', array_values($c['opts'])),
                    'sku'        => $c['sku'],
                    'options'    => json_encode($c['opts'], JSON_UNESCAPED_UNICODE),
                    'price'      => $c['price'],
                    'stock'      => $c['stock'],
                    'image'      => null,
                    'status'     => 'active',
                ], false);
            }
            echo "Product: {$p['name']} (id={$productId}, " . count($p['combos']) . " variants)\n";
        }
    }

    /**
     * Bakery hierarchy: Vendor → multiple product sub-categories → multiple products.
     * Splits the flat "Bakery Items" bucket into Cakes / Puffs / Breads, migrates the
     * two existing items to their right sub-category, and adds the 5 missing products.
     * Idempotent.
     */
    private function seedBakerySubCategories(): void
    {
        $cats     = new CategoryModel();
        $vcats    = new VendorCategoryModel();
        $users    = new UserModel();
        $products = new ProductModel();
        $variants = new ProductVariantModel();

        $bakeryVc = $vcats->where('name', 'Bakery')->first();
        if (! $bakeryVc) { echo "Bakery sub-categories skipped: vendor category missing\n"; return; }
        $vcid = (int) $bakeryVc['id'];

        $vendor = $users->where('mobile_number', '9999000021')->where('role', 'vendor')->first();
        if (! $vendor) { echo "Bakery sub-categories skipped: vendor missing\n"; return; }
        $vendorId = (int) $vendor['id'];

        $img = static fn (string $bg, string $fg, string $label): string =>
            "https://placehold.co/600x600/{$bg}/{$fg}/png?text=" . rawurlencode($label);

        // 1. Create Cakes / Puffs / Breads sub-categories
        $subCatIds = [];
        foreach ([
            ['name' => 'Cakes',  'commission' => 6],
            ['name' => 'Puffs',  'commission' => 5],
            ['name' => 'Breads', 'commission' => 5],
        ] as $sc) {
            $row = $cats->where('name', $sc['name'])->first();
            if ($row) {
                $subCatIds[$sc['name']] = (int) $row['id'];
                if ((int) ($row['vendor_category_id'] ?? 0) !== $vcid) {
                    $cats->update($row['id'], ['vendor_category_id' => $vcid]);
                }
            } else {
                $subCatIds[$sc['name']] = (int) $cats->insert([
                    'name'               => $sc['name'],
                    'commission_pct'     => $sc['commission'],
                    'vendor_category_id' => $vcid,
                    'status'             => 'active',
                ], true);
                echo "Created Bakery sub-category: {$sc['name']}\n";
            }
        }

        // 2. Migrate existing items from "Bakery Items" to their right sub-category
        $migrations = [
            'Chocolate Truffle Cake' => 'Cakes',
            'Cheese Garlic Bread'    => 'Breads',
        ];
        foreach ($migrations as $productName => $targetSubCat) {
            $p = $products->where('name', $productName)->first();
            if ($p && (int) ($p['category_id'] ?? 0) !== $subCatIds[$targetSubCat]) {
                $products->update($p['id'], ['category_id' => $subCatIds[$targetSubCat]]);
                echo "Migrated {$productName} → {$targetSubCat}\n";
            }
        }

        // 3. New products
        $catalog = [
            [
                'sub' => 'Cakes',
                'name' => 'Black Forest Cake',
                'description' => 'Layered chocolate sponge, whipped cream, kirsch-soaked cherries.',
                'image' => $img('1f2937', 'fef3c7', 'Black+Forest'),
                'variant_types' => [['name' => 'Size', 'options' => ['500GM', '1KG', '2KG']]],
                'variant_images' => ['Size' => [
                    '500GM' => [$img('1f2937', 'fef3c7', 'BlackForest+500'), $img('111827', 'fef3c7', 'BlackForest+500+Slice')],
                    '1KG'   => [$img('374151', 'fef3c7', 'BlackForest+1KG'), $img('1f2937', 'fef3c7', 'BlackForest+1KG+Slice')],
                    '2KG'   => [$img('4b5563', 'fef3c7', 'BlackForest+2KG'), $img('374151', 'fef3c7', 'BlackForest+2KG+Slice')],
                ]],
                'combos' => [
                    ['opts' => ['Size' => '500GM'], 'sku' => 'BFOR-500', 'price' => 400,  'stock' => 5],
                    ['opts' => ['Size' => '1KG'],   'sku' => 'BFOR-1K',  'price' => 750,  'stock' => 3],
                    ['opts' => ['Size' => '2KG'],   'sku' => 'BFOR-2K',  'price' => 1400, 'stock' => 1],
                ],
            ],
            [
                'sub' => 'Cakes',
                'name' => 'Red Velvet Cake',
                'description' => 'Moist red velvet sponge with cream-cheese frosting. Customisable message.',
                'image' => $img('991b1b', 'ffffff', 'Red+Velvet'),
                'variant_types' => [['name' => 'Size', 'options' => ['500GM', '1KG', '2KG']]],
                'variant_images' => ['Size' => [
                    '500GM' => [$img('b91c1c', 'ffffff', 'RedVelvet+500'), $img('991b1b', 'ffffff', 'RedVelvet+500+Slice')],
                    '1KG'   => [$img('991b1b', 'ffffff', 'RedVelvet+1KG'), $img('7f1d1d', 'ffffff', 'RedVelvet+1KG+Slice')],
                    '2KG'   => [$img('7f1d1d', 'ffffff', 'RedVelvet+2KG'), $img('450a0a', 'ffffff', 'RedVelvet+2KG+Slice')],
                ]],
                'combos' => [
                    ['opts' => ['Size' => '500GM'], 'sku' => 'RVEL-500', 'price' => 420,  'stock' => 4],
                    ['opts' => ['Size' => '1KG'],   'sku' => 'RVEL-1K',  'price' => 800,  'stock' => 3],
                    ['opts' => ['Size' => '2KG'],   'sku' => 'RVEL-2K',  'price' => 1500, 'stock' => 1],
                ],
            ],
            [
                'sub' => 'Puffs',
                'name' => 'Veg Puff',
                'description' => 'Flaky puff pastry filled with masala-spiced vegetable curry. Vegetarian.',
                'image' => $img('a16207', 'ffffff', 'Veg+Puff'),
                'variant_types' => [['name' => 'Pack', 'options' => ['1 Piece', '2 Pieces', '6 Pieces']]],
                'variant_images' => ['Pack' => [
                    '1 Piece'  => [$img('eab308', '422006', 'VegPuff+1'),  $img('ca8a04', '422006', 'VegPuff+1+Bite')],
                    '2 Pieces' => [$img('ca8a04', 'ffffff', 'VegPuff+2'),  $img('a16207', 'ffffff', 'VegPuff+2+Bite')],
                    '6 Pieces' => [$img('854d0e', 'ffffff', 'VegPuff+6'),  $img('713f12', 'ffffff', 'VegPuff+6+Box')],
                ]],
                'combos' => [
                    ['opts' => ['Pack' => '1 Piece'],  'sku' => 'VPUFF-1', 'price' => 25,  'stock' => 50],
                    ['opts' => ['Pack' => '2 Pieces'], 'sku' => 'VPUFF-2', 'price' => 45,  'stock' => 30],
                    ['opts' => ['Pack' => '6 Pieces'], 'sku' => 'VPUFF-6', 'price' => 120, 'stock' => 12],
                ],
            ],
            [
                'sub' => 'Puffs',
                'name' => 'Chicken Puff',
                'description' => 'Flaky puff pastry with spiced minced-chicken filling. Halal-certified.',
                'image' => $img('7c2d12', 'ffffff', 'Chicken+Puff'),
                'variant_types' => [['name' => 'Pack', 'options' => ['1 Piece', '2 Pieces', '6 Pieces']]],
                'variant_images' => ['Pack' => [
                    '1 Piece'  => [$img('ea580c', 'ffffff', 'ChickenPuff+1'), $img('c2410c', 'ffffff', 'ChickenPuff+1+Bite')],
                    '2 Pieces' => [$img('c2410c', 'ffffff', 'ChickenPuff+2'), $img('9a3412', 'ffffff', 'ChickenPuff+2+Bite')],
                    '6 Pieces' => [$img('7c2d12', 'ffffff', 'ChickenPuff+6'), $img('431407', 'ffffff', 'ChickenPuff+6+Box')],
                ]],
                'combos' => [
                    ['opts' => ['Pack' => '1 Piece'],  'sku' => 'CPUFF-1', 'price' => 35,  'stock' => 40],
                    ['opts' => ['Pack' => '2 Pieces'], 'sku' => 'CPUFF-2', 'price' => 65,  'stock' => 25],
                    ['opts' => ['Pack' => '6 Pieces'], 'sku' => 'CPUFF-6', 'price' => 180, 'stock' => 10],
                ],
            ],
            [
                'sub' => 'Breads',
                'name' => 'Milk Bread',
                'description' => 'Soft, milky white bread. Perfect for sandwiches and breakfast toast.',
                'image' => $img('fef3c7', '422006', 'Milk+Bread'),
                'variant_types' => [['name' => 'Size', 'options' => ['Small (250GM)', 'Regular (400GM)', 'Family (800GM)']]],
                'variant_images' => ['Size' => [
                    'Small (250GM)'   => [$img('fef9c3', '422006', 'MilkBread+S'), $img('fef08a', '422006', 'MilkBread+S+Slice')],
                    'Regular (400GM)' => [$img('fde047', '422006', 'MilkBread+R'), $img('facc15', '422006', 'MilkBread+R+Slice')],
                    'Family (800GM)'  => [$img('eab308', '422006', 'MilkBread+F'), $img('ca8a04', '422006', 'MilkBread+F+Slice')],
                ]],
                'combos' => [
                    ['opts' => ['Size' => 'Small (250GM)'],   'sku' => 'MBRD-S', 'price' => 35,  'stock' => 30],
                    ['opts' => ['Size' => 'Regular (400GM)'], 'sku' => 'MBRD-R', 'price' => 55,  'stock' => 25],
                    ['opts' => ['Size' => 'Family (800GM)'],  'sku' => 'MBRD-F', 'price' => 95,  'stock' => 15],
                ],
            ],
        ];

        foreach ($catalog as $p) {
            if ($products->where('name', $p['name'])->first()) {
                echo "Skip Bakery product (exists): {$p['name']}\n";
                continue;
            }
            $catId      = $subCatIds[$p['sub']] ?? null;
            if (! $catId) continue;
            $totalStock = array_sum(array_column($p['combos'], 'stock'));
            $minPrice   = min(array_column($p['combos'], 'price'));
            $productId  = (int) $products->insert([
                'vendor_id'      => $vendorId,
                'category_id'    => $catId,
                'name'           => $p['name'],
                'description'    => $p['description'],
                'price'          => $minPrice,
                'stock'          => $totalStock,
                'has_variants'   => 1,
                'variant_types'  => json_encode($p['variant_types'], JSON_UNESCAPED_UNICODE),
                'variant_images' => json_encode($p['variant_images'], JSON_UNESCAPED_UNICODE),
                'image'          => $p['image'],
                'status'         => 'active',
            ], true);
            foreach ($p['combos'] as $c) {
                $variants->insert([
                    'product_id' => $productId,
                    'name'       => implode(' + ', array_values($c['opts'])),
                    'sku'        => $c['sku'],
                    'options'    => json_encode($c['opts'], JSON_UNESCAPED_UNICODE),
                    'price'      => $c['price'],
                    'stock'      => $c['stock'],
                    'image'      => null,
                    'status'     => 'active',
                ], false);
            }
            echo "Bakery product: {$p['name']} → {$p['sub']} (id={$productId})\n";
        }
    }

    /**
     * Sample customer MLM tree rooted at the Dev Customer (9999000006).
     *
     *   Dev Customer
     *     ├── Asha M.        (L1)
     *     │     ├── Vimal P.   (L2 for Dev)
     *     │     │     └── Arun T.    (L3 for Dev)
     *     │     └── Geetha N.  (L2 for Dev)
     *     ├── Karthik R.     (L1)
     *     │     └── Rahul J.   (L2 for Dev)
     *     │           └── Meena B.  (L3 for Dev)
     *     ├── Suresh K.      (L1)
     *     │     └── Lakshmi V. (L2 for Dev)
     *     └── Priya S.       (L1)
     *
     * Each direct (parent → child) relationship gets a level-1 referral row.
     * For commission tracking the table also stores level-2 + level-3 rows
     * for grandparent / great-grandparent uplines so a single SELECT can
     * answer "all my L2 referrals" without walking the chain.
     *
     * After this runs:
     *   - admin /customers shows all 10 sample customers + Dev Customer
     *   - Dev Customer's /refer page shows their 4 direct (L1) referrals
     *   - Dev Customer's dashboard shows L1=4, L2=4, L3=2 + level_wallet=₹60
     *   - Each L1 customer's own /refer shows their downline
     */
    private function seedReferrals(): void
    {
        $users     = new UserModel();
        $referrals = new ReferralModel();

        $dev = $users->where('mobile_number', '9999000006')->where('role', 'customer')->first();
        if (! $dev) {
            echo "Skip referrals: Dev Customer not found\n";
            return;
        }
        $devId = (int) $dev['id'];

        $password = 'change-me';
        $hash     = password_hash($password, PASSWORD_BCRYPT);

        // Welcome bonus = ₹15 to direct referrer (per spec). The L2/L3 rows
        // track lineage for MLM commission tracking — no welcome bonus there;
        // commissions on sales are computed elsewhere (CommissionService).
        $welcomeBonus    = 15.00;
        $l2LineageBonus  = 0.00;
        $l3LineageBonus  = 0.00;

        // Sample tree definition.
        // 'parent' is the mobile of who referred this person. null → Dev Customer.
        $tree = [
            // L1 — direct referrals of Dev Customer
            ['name' => 'Asha M.',    'mobile' => '9876543210', 'pincode' => '641001', 'wallet' =>  320, 'parent' => null],
            ['name' => 'Karthik R.', 'mobile' => '9876543212', 'pincode' => '641002', 'wallet' => 1240, 'parent' => null],
            ['name' => 'Suresh K.',  'mobile' => '9876543214', 'pincode' => '641003', 'wallet' =>    0, 'parent' => null],
            ['name' => 'Priya S.',   'mobile' => '9876543216', 'pincode' => '641002', 'wallet' =>  580, 'parent' => null],
            // L2 — referred by L1 customers
            ['name' => 'Vimal P.',   'mobile' => '9876543220', 'pincode' => '641001', 'wallet' =>  150, 'parent' => '9876543210'], // by Asha
            ['name' => 'Geetha N.',  'mobile' => '9876543222', 'pincode' => '641001', 'wallet' =>   90, 'parent' => '9876543210'], // by Asha
            ['name' => 'Rahul J.',   'mobile' => '9876543224', 'pincode' => '641002', 'wallet' =>  410, 'parent' => '9876543212'], // by Karthik
            ['name' => 'Lakshmi V.', 'mobile' => '9876543226', 'pincode' => '641003', 'wallet' =>  220, 'parent' => '9876543214'], // by Suresh
            // L3 — referred by L2 customers
            ['name' => 'Arun T.',    'mobile' => '9876543230', 'pincode' => '641001', 'wallet' =>   45, 'parent' => '9876543220'], // by Vimal
            ['name' => 'Meena B.',   'mobile' => '9876543232', 'pincode' => '641002', 'wallet' =>  175, 'parent' => '9876543224'], // by Rahul
        ];

        // Pass 1: ensure all user rows exist; build mobile → id map.
        $idByMobile = ['9999000006' => $devId];
        foreach ($tree as $s) {
            $existing = $users->where('mobile_number', $s['mobile'])->where('role', 'customer')->first();
            if ($existing) {
                $idByMobile[$s['mobile']] = (int) $existing['id'];
                echo "Skip user (exists): {$s['mobile']}\n";
                continue;
            }
            $newId = (int) $users->insert([
                'name'           => $s['name'],
                'mobile_number'  => $s['mobile'],
                'password_hash'  => $hash,
                'role'           => 'customer',
                'status'         => 'active',
                'pincode'        => $s['pincode'],
                'wallet_balance' => $s['wallet'],
            ], true);
            $idByMobile[$s['mobile']] = $newId;
            echo "Created customer: {$s['mobile']} ({$s['name']})\n";
        }

        // Pass 1b: set users.referrer_id on each tree node. CommissionService
        // walks the chain via this column on every purchase, so missing values
        // mean no L1/L2/L3 cascade. Idempotent.
        foreach ($tree as $s) {
            $userId       = $idByMobile[$s['mobile']];
            $parentMobile = $s['parent'] ?? '9999000006';
            $parentId     = $idByMobile[$parentMobile] ?? null;
            if (! $parentId) continue;
            $users->update($userId, ['referrer_id' => $parentId]);
        }

        // Pass 2: insert referral rows. For each user, walk up the chain and
        // create a row at each level (1, 2, 3) up to the Dev Customer root.
        $upsert = function (int $referrerId, int $referredId, int $level, float $bonus) use ($referrals) {
            $exists = $referrals->where('referrer_id', $referrerId)->where('referred_id', $referredId)->first();
            if ($exists) return;
            $referrals->insert([
                'referrer_id'  => $referrerId,
                'referred_id'  => $referredId,
                'level'        => $level,
                'bonus_amount' => $bonus,
            ]);
        };

        foreach ($tree as $s) {
            $referredId   = $idByMobile[$s['mobile']];
            $parentMobile = $s['parent'] ?? '9999000006'; // null → Dev Customer

            // L1 — direct parent
            $l1Id = $idByMobile[$parentMobile] ?? null;
            if ($l1Id) {
                $upsert($l1Id, $referredId, 1, $welcomeBonus);

                // L2 — grandparent (parent of L1)
                $l1Row = $users->find($l1Id);
                $l2Parent = $this->parentOf($l1Row['mobile_number'] ?? '', $tree);
                $l2Id = $l2Parent ? ($idByMobile[$l2Parent] ?? null) : null;
                if (! $l2Id && $l1Row && $l1Row['mobile_number'] !== '9999000006') {
                    // L1 was referred by Dev (no parent in tree definition)
                    $l2Id = $devId;
                }
                if ($l2Id && $l2Id !== $l1Id) {
                    $upsert($l2Id, $referredId, 2, $l2LineageBonus);

                    // L3 — great-grandparent (parent of L2)
                    $l2Row = $users->find($l2Id);
                    $l3Parent = $l2Row ? $this->parentOf($l2Row['mobile_number'] ?? '', $tree) : null;
                    $l3Id = $l3Parent ? ($idByMobile[$l3Parent] ?? null) : null;
                    if (! $l3Id && $l2Row && $l2Row['mobile_number'] !== '9999000006' && $l2Id !== $devId) {
                        $l3Id = $devId;
                    }
                    if ($l3Id && $l3Id !== $l1Id && $l3Id !== $l2Id) {
                        $upsert($l3Id, $referredId, 3, $l3LineageBonus);
                    }
                }
            }
        }

        // Pass 3: recompute level counts + level_wallet for every node, including Dev Customer.
        foreach ($idByMobile as $userId) {
            $l1 = (int) $referrals->where('referrer_id', $userId)->where('level', 1)->countAllResults();
            $l2 = (int) $referrals->where('referrer_id', $userId)->where('level', 2)->countAllResults();
            $l3 = (int) $referrals->where('referrer_id', $userId)->where('level', 3)->countAllResults();
            $sumBonus = (float) ($referrals->selectSum('bonus_amount')->where('referrer_id', $userId)->first()['bonus_amount'] ?? 0);
            $users->update($userId, [
                'level_1_count' => $l1,
                'level_2_count' => $l2,
                'level_3_count' => $l3,
                'level_wallet'  => $sumBonus,
            ]);
        }

        $devCounts = $users->find($devId);
        echo "Dev Customer: L1={$devCounts['level_1_count']} L2={$devCounts['level_2_count']} L3={$devCounts['level_3_count']} level_wallet=₹{$devCounts['level_wallet']}\n";
    }

    /** Find the parent mobile (referrer) for a given mobile in the tree definition. */
    private function parentOf(string $mobile, array $tree): ?string
    {
        foreach ($tree as $node) {
            if ($node['mobile'] === $mobile) return $node['parent'];
        }
        return null;
    }
}
