<?php

namespace App\Controllers\Api;

use App\Models\CategoryModel;
use App\Models\ProductModel;
use App\Models\ProductVariantModel;
use App\Models\UserModel;
use App\Models\VariantTypeGroupModel;
use App\Models\VendorProfileModel;
use CodeIgniter\HTTP\ResponseInterface;

class ProductController extends BaseApiController
{
    /** Material Master import columns by type — written through persistProduct(). */
    private const MM_DECIMALS = [
        'cost_price', 'profit_percent', 'profit', 'basic_price', 'discount_percent', 'discount',
        'wholesale_profit_percent', 'wholesale_profit', 'wholesale_price', 'incentive', 'incentive_percent',
        'cashback', 'cashback_percent', 'net_profit', 'tax_amount', 'wholesales_2', 'gst', 'gst_value',
        'supplier_price', 'agent_commission_perc', 'agent_commission', 'cess', 'cess_rate', 'covid',
        'covid_percent', 'cost_price_exceed',
    ];
    private const MM_STRINGS = ['manual_rate', 'tax_type', 'agent', 'csquare', 'multi_pricing'];
    private const MM_DATES   = ['created_date', 'modified_date'];

    /** Comprehensive catalog import columns by type — written through catalogColumns(). */
    private const CAT_DECIMALS = [
        'tax_percentage', 'discount_value', 'discount_amount', 'weight', 'length', 'width', 'height', 'delivery_charge',
    ];
    private const CAT_INTS    = ['min_stock_alert', 'max_order_qty', 'return_days', 'warranty_days'];
    private const CAT_STRINGS = ['brand', 'hsn_code', 'unit', 'short_description', 'tags'];

    /** Customer-facing list — only active products. Staff may pass location filters. */
    public function index(): ResponseInterface
    {
        $auth  = $this->authUser();
        $q     = $this->request->getGet('q');
        $catId = (int) $this->request->getGet('category_id');

        $model = (new ProductModel())->where('products.status', 'active');
        if ($q)     $model->like('products.name', $q);
        if ($catId) $model->where('products.category_id', $catId);

        // Location/vendor filters — staff/admin only.
        $isStaff = $auth && in_array($auth->role, ['vendor','taluk','district','state','admin'], true);
        if ($isStaff) {
            $vendorId   = (int) $this->request->getGet('vendor_id');
            $districtId = (int) $this->request->getGet('district_id');
            $talukId    = (int) $this->request->getGet('taluk_id');
            $stateId    = (int) $this->request->getGet('state_id');

            if ($vendorId) $model->where('products.vendor_id', $vendorId);

            if ($districtId || $talukId || $stateId) {
                $vp = new VendorProfileModel();
                if ($districtId) $vp->where('district_id', $districtId);
                if ($talukId)    $vp->where('taluk_id', $talukId);
                if ($stateId)    $vp->where('state_id', $stateId);
                $vendorIds = $vp->findColumn('user_id') ?: [];
                if (! $vendorIds) {
                    $cats = (new CategoryModel())->where('status', 'active')->findAll();
                    return $this->ok(['items' => [], 'categories' => $cats]);
                }
                $model->whereIn('products.vendor_id', $vendorIds);
            }
        }

        $items = $model->orderBy('products.id', 'DESC')->findAll(100);

        // For products that have variants, expose min/max price range.
        $ids = array_map(static fn ($r) => (int) $r['id'], $items);
        $ranges = [];
        if ($ids) {
            $rows = (new ProductVariantModel())
                ->select('product_id, MIN(price) AS min_price, MAX(price) AS max_price')
                ->whereIn('product_id', $ids)
                ->where('status', 'active')
                ->groupBy('product_id')
                ->findAll();
            foreach ($rows as $r) $ranges[(int) $r['product_id']] = ['min_price' => (float) $r['min_price'], 'max_price' => (float) $r['max_price']];
        }
        foreach ($items as &$it) {
            if ((int) ($it['has_variants'] ?? 0) === 1 && isset($ranges[(int) $it['id']])) {
                $it['min_price'] = $ranges[(int) $it['id']]['min_price'];
                $it['max_price'] = $ranges[(int) $it['id']]['max_price'];
            }
        }
        unset($it);

        $items = $this->enrich($items);
        $cats  = (new CategoryModel())->where('status', 'active')->findAll();
        return $this->ok(['items' => $items, 'categories' => $cats]);
    }

    public function show(int $id): ResponseInterface
    {
        $row = (new ProductModel())->find($id);
        if (! $row) return $this->fail('Not found', 404);
        $enriched = $this->enrich([$row]);
        $variants = (new ProductVariantModel())
            ->where('product_id', $id)
            ->where('status', 'active')
            ->orderBy('id', 'ASC')
            ->findAll();
        $variants = array_map(static function ($v) {
            $raw = $v['options'] ?? null;
            $v['options'] = is_string($raw) ? (json_decode($raw, true) ?: []) : (is_array($raw) ? $raw : []);
            $v['price']   = (float) ($v['price'] ?? 0);
            $v['stock']   = (int) ($v['stock'] ?? 0);
            return $v;
        }, $variants);

        $variantTypes = $this->decodeVariantTypes($row['variant_types'] ?? null);
        $rawVImgs = $row['variant_images'] ?? null;
        $variantImages = is_string($rawVImgs) ? (json_decode($rawVImgs, true) ?: []) : (is_array($rawVImgs) ? $rawVImgs : []);

        // Schema: merge fields from every active variant_type_group linked to this
        // product's category. Dedupe by key (first-wins) in case multiple groups overlap.
        $schema = [];
        $catId  = (int) ($row['category_id'] ?? 0);
        if ($catId > 0) {
            $groups = (new VariantTypeGroupModel())
                ->where('category_id', $catId)
                ->where('status', 'active')
                ->orderBy('id', 'ASC')
                ->findAll();
            $seen = [];
            foreach ($groups as $g) {
                $raw = $g['fields'] ?? null;
                $fields = is_string($raw) ? (json_decode($raw, true) ?: []) : (is_array($raw) ? $raw : []);
                foreach ($fields as $f) {
                    $key = (string) ($f['key'] ?? '');
                    if ($key === '' || isset($seen[$key])) continue;
                    $seen[$key] = true;
                    $schema[] = $f;
                }
            }
        }

        return $this->ok([
            'item'             => $enriched[0],
            'variants'         => $variants,
            'variant_types'    => $variantTypes,
            'variant_images'   => $variantImages,
            'attribute_schema' => $schema,
        ]);
    }

    /** Enrich product rows with vendor_name + category_name + decoded variant data + variant rows. */
    private function enrich(array $rows): array
    {
        if (! $rows) return [];
        $catIds    = array_unique(array_filter(array_map(static fn ($r) => (int) ($r['category_id'] ?? 0), $rows)));
        $vendorIds = array_unique(array_filter(array_map(static fn ($r) => (int) ($r['vendor_id']   ?? 0), $rows)));
        $productIds = array_map(static fn ($r) => (int) ($r['id'] ?? 0), $rows);
        $cats      = $catIds    ? (new CategoryModel())->whereIn('id', $catIds)->findAll() : [];
        $vendors   = $vendorIds ? (new UserModel())->whereIn('id', $vendorIds)->findAll() : [];
        $profiles  = $vendorIds ? (new VendorProfileModel())->whereIn('user_id', $vendorIds)->findAll() : [];
        $variants  = $productIds ? (new ProductVariantModel())->whereIn('product_id', $productIds)->orderBy('id', 'ASC')->findAll() : [];
        $catName   = []; foreach ($cats     as $c) $catName[(int) $c['id']]      = $c['name'];
        $vendName  = []; foreach ($vendors  as $v) $vendName[(int) $v['id']]     = $v['name'];
        $shopName  = []; foreach ($profiles as $p) $shopName[(int) $p['user_id']] = $p['shop_name'];
        $variantsByProduct = [];
        foreach ($variants as $v) {
            $pid = (int) $v['product_id'];
            $raw = $v['options'] ?? null;
            $v['options'] = is_string($raw) ? (json_decode($raw, true) ?: []) : (is_array($raw) ? $raw : []);
            $v['price']   = (float) ($v['price'] ?? 0);
            $v['stock']   = (int) ($v['stock'] ?? 0);
            $variantsByProduct[$pid][] = $v;
        }
        return array_map(static function ($r) use ($catName, $vendName, $shopName, $variantsByProduct) {
            $rawAttrs = $r['attributes'] ?? null;
            $attrs    = is_string($rawAttrs) ? (json_decode($rawAttrs, true) ?: null) : (is_array($rawAttrs) ? $rawAttrs : null);
            $rawTypes = $r['variant_types'] ?? null;
            $vTypes   = is_string($rawTypes) ? (json_decode($rawTypes, true) ?: []) : (is_array($rawTypes) ? $rawTypes : []);
            $rawImgs  = $r['variant_images'] ?? null;
            $vImgs    = is_string($rawImgs) ? (json_decode($rawImgs, true) ?: []) : (is_array($rawImgs) ? $rawImgs : []);
            return array_merge($r, [
                'category_name'  => $catName[(int) ($r['category_id'] ?? 0)]  ?? null,
                'vendor_name'    => $shopName[(int) ($r['vendor_id'] ?? 0)] ?? $vendName[(int) ($r['vendor_id'] ?? 0)] ?? null,
                'price'          => (float) ($r['price'] ?? 0),
                'stock'          => (int)   ($r['stock'] ?? 0),
                'has_variants'   => (bool)  ($r['has_variants'] ?? 0),
                'attributes'     => $attrs,
                'variant_types'  => $vTypes,
                'variant_images' => $vImgs,
                'variants'       => $variantsByProduct[(int) ($r['id'] ?? 0)] ?? [],
            ]);
        }, $rows);
    }

    /** Vendor: list my products. */
    public function mine(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, ['vendor', 'admin'], true)) return $this->fail('Forbidden', 403);
        $model = new ProductModel();
        if ($auth->role === 'vendor') $model->where('vendor_id', $auth->id);
        $rows = $model->orderBy('id', 'DESC')->findAll();
        $rows = $this->enrich($rows);
        return $this->ok(['items' => $rows]);
    }

    public function create(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, ['vendor', 'admin'], true)) return $this->fail('Forbidden', 403);

        if (! $this->validate([
            'name'        => 'required|string|max_length[200]',
            'price'       => 'required|numeric|greater_than_equal_to[0]',
            'stock'       => 'permit_empty|integer|greater_than_equal_to[0]',
            'category_id' => 'permit_empty|integer',
        ])) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }
        $d        = $this->request->getJSON(true) ?? $this->request->getPost();
        $vendorId = $auth->role === 'admin' ? (int) ($d['vendor_id'] ?? $auth->id) : (int) $auth->id;
        $id       = $this->persistProduct($d, $vendorId);
        return $this->ok(['id' => $id], 'Created');
    }

    /**
     * Bulk-create products (with variants) from a CSV import.
     * Body: { items: [ { name, price, stock?, category_id?, description?, status?,
     *                    variant_types?, variants? }, ... ] }
     * All-or-nothing: if any row is invalid the whole batch is rolled back so the
     * vendor can fix the file and retry without leaving partial duplicates behind.
     */
    public function bulkCreate(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, ['vendor', 'admin'], true)) return $this->fail('Forbidden', 403);

        $d     = $this->request->getJSON(true) ?? $this->request->getPost();
        $items = $d['items'] ?? null;
        if (! is_array($items) || ! $items) return $this->fail('No items to import', 422);
        if (count($items) > 500)            return $this->fail('Too many rows (max 500 per import)', 422);

        $db = \Config\Database::connect();
        $db->transStart();

        $created = 0;
        $updated = 0;       // update-details
        $addStock = 0;      // products that got stock added
        $replaceStock = 0;  // products that got stock replaced
        $unitsAdded = 0;    // total stock units added
        $errors  = [];
        foreach (array_values($items) as $i => $item) {
            $line = $i + 1;
            if (! is_array($item)) { $errors[] = ['row' => $line, 'error' => 'Invalid item']; continue; }
            $name  = trim((string) ($item['name'] ?? ''));
            $price = $item['price'] ?? null;
            if ($name === '')                               { $errors[] = ['row' => $line, 'error' => 'Name is required']; continue; }
            if (! is_numeric($price) || (float) $price < 0) { $errors[] = ['row' => $line, 'error' => 'Valid price is required']; continue; }

            // An `id` means "act on this existing product" (matched product).
            $pid = isset($item['id']) ? (int) $item['id'] : 0;
            if ($pid > 0) {
                $row = (new ProductModel())->find($pid);
                if (! $row) { $errors[] = ['row' => $line, 'error' => "Product #{$pid} not found"]; continue; }
                if ($auth->role !== 'admin' && (int) $row['vendor_id'] !== (int) $auth->id) {
                    $errors[] = ['row' => $line, 'error' => "Product #{$pid} is not yours"]; continue;
                }
                $action = (string) ($item['action'] ?? 'update');
                if ($action === 'add_stock' || $action === 'replace_stock') {
                    $added = $this->applyStockChange($pid, $row, $item, $action === 'add_stock' ? 'add' : 'replace');
                    if ($action === 'add_stock') { $addStock++; $unitsAdded += $added; }
                    else                          { $replaceStock++; }
                } else {
                    $this->applyProductUpdate($pid, $item);
                    $updated++;
                }
            } else {
                $vendorId = $auth->role === 'admin' ? (int) ($item['vendor_id'] ?? $auth->id) : (int) $auth->id;
                $this->persistProduct($item, $vendorId);
                $created++;
            }
        }

        if ($errors) {
            $db->transRollback();
            return $this->fail('Import failed — fix the listed rows and retry', 422, $errors);
        }
        $db->transComplete();
        if ($db->transStatus() === false) return $this->fail('Import failed', 500);

        $parts = [];
        if ($created)      $parts[] = "{$created} created";
        if ($updated)      $parts[] = "{$updated} updated";
        if ($addStock)     $parts[] = "{$addStock} stock-added";
        if ($replaceStock) $parts[] = "{$replaceStock} stock-replaced";
        return $this->ok([
            'created'       => $created,
            'updated'       => $updated,
            'stock_added'   => $addStock,
            'stock_replaced' => $replaceStock,
            'units_added'   => $unitsAdded,
        ], $parts ? ('Import: ' . implode(', ', $parts)) : 'Nothing imported');
    }

    /**
     * Admin bulk-import a vendor's catalog (comprehensive structure). Per row:
     *  - requires Product Name + a valid Selling Price (else counted as failed),
     *  - auto-creates the Category and (under it) the Sub Category, pointing the
     *    product at the deepest one,
     *  - upserts by SKU/Code: an existing code is updated, a new code is created;
     *    a row with no code falls back to skip-by-name,
     *  - stores every catalog column and computes discount_amount / tax_amount.
     * Bad rows are reported but never abort the rest (no all-or-nothing rollback).
     * The frontend chunks large catalogs into ~250-row calls and aggregates this.
     * Returns: { created, updated, skipped, failed_count, failed[], total }.
     */
    public function adminImport(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'admin') return $this->fail('Forbidden', 403);

        $d        = $this->request->getJSON(true) ?? $this->request->getPost();
        $vendorId = isset($d['vendor_id']) ? (int) $d['vendor_id'] : 0;
        $items    = $d['items'] ?? null;
        if (! is_array($items) || ! $items) return $this->fail('No rows to import', 422);
        if (count($items) > 2000)           return $this->fail('Too many rows (max 2000 per request)', 422);

        $vendor = (new UserModel())->find($vendorId);
        if (! $vendor || $vendor['role'] !== 'vendor') return $this->fail('Pick a valid vendor', 422);

        $model    = new ProductModel();
        $catModel = new CategoryModel();

        // Categories keyed by "<parentId|0>|<lower name>" — created on demand so a
        // sub-category resolves under its own parent (uniqueness per parent+name).
        $catMap = [];
        foreach ($catModel->findAll() as $c) {
            $pid = isset($c['parent_id']) && $c['parent_id'] !== null ? (int) $c['parent_id'] : 0;
            $catMap[$pid . '|' . mb_strtolower(trim((string) $c['name']))] = (int) $c['id'];
        }
        $resolveCat = static function (string $name, int $parentId) use (&$catMap, $catModel): ?int {
            $name = trim($name);
            if ($name === '') return null;
            $key = $parentId . '|' . mb_strtolower($name);
            if (isset($catMap[$key])) return $catMap[$key];
            $id = (int) $catModel->insert([
                'name'      => $name,
                'parent_id' => $parentId ?: null,
                'status'    => 'active',
            ], true);
            $catMap[$key] = $id;
            return $id;
        };

        // Existing products for this vendor — for upsert-by-code / skip-by-name.
        $byCode = [];
        $byName = [];
        foreach ($model->where('vendor_id', $vendorId)->findAll() as $p) {
            $byName[mb_strtolower(trim((string) $p['name']))] = (int) $p['id'];
            if (! empty($p['code'])) $byCode[mb_strtolower(trim((string) $p['code']))] = (int) $p['id'];
        }

        $created = 0; $updated = 0; $skipped = 0; $failed = [];

        foreach (array_values($items) as $i => $item) {
            $line = $i + 1;
            try {
                if (! is_array($item)) { $failed[] = ['row' => $line, 'name' => '', 'reason' => 'Invalid row']; continue; }

                $name  = trim((string) ($item['name'] ?? ''));
                $price = $item['price'] ?? null;
                if ($name === '')                               { $failed[] = ['row' => $line, 'name' => $name, 'reason' => 'Product Name required']; continue; }
                if (! is_numeric($price) || (float) $price < 0) { $failed[] = ['row' => $line, 'name' => $name, 'reason' => 'Valid Selling Price required']; continue; }
                $price = (float) $price;

                // Category → Sub Category (the deepest resolved one wins as category_id).
                $catId      = null;
                $parentName = trim((string) ($item['category'] ?? ''));
                $subName    = trim((string) ($item['sub_category'] ?? ''));
                if ($parentName !== '') {
                    $catId = $resolveCat($parentName, 0);
                    if ($subName !== '' && $catId) {
                        $sid = $resolveCat($subName, $catId);
                        if ($sid) $catId = $sid;
                    }
                } elseif ($subName !== '') {
                    $catId = $resolveCat($subName, 0);
                }

                $code = trim((string) ($item['code'] ?? ''));
                $cKey = $code !== '' ? mb_strtolower($code) : null;
                $nKey = mb_strtolower($name);

                // Resolved base fields. null = "leave unchanged" on update.
                $statusRaw = mb_strtolower(trim((string) ($item['status'] ?? '')));
                $status    = $statusRaw === '' ? null : (in_array($statusRaw, ['inactive', '0', 'no', 'disabled', 'off'], true) ? 'inactive' : 'active');
                $stockRaw  = $item['stock'] ?? '';
                $stock     = is_numeric($stockRaw) ? (int) $stockRaw : null;
                $base = [
                    'category_id' => $catId,
                    'name'        => $name,
                    'description' => trim((string) ($item['description'] ?? '')) !== '' ? trim((string) $item['description']) : null,
                    'price'       => $price,
                    'mrp'         => isset($item['mrp']) && is_numeric($item['mrp']) ? (float) $item['mrp'] : null,
                    'code'        => $code !== '' ? $code : null,
                    'barcode'     => trim((string) ($item['barcode'] ?? '')) !== '' ? trim((string) $item['barcode']) : null,
                    'image'       => ! empty($item['image']) ? trim((string) $item['image']) : null,
                    'status'      => $status,
                    'stock'       => $stock,
                ];

                // UPDATE existing (matched by code). Strip nulls so blank cells in
                // the sheet don't wipe existing data.
                if ($cKey !== null && isset($byCode[$cKey])) {
                    $payload = array_merge($base, $this->catalogColumns($item));
                    $payload = array_filter($payload, static fn ($v) => $v !== null);
                    $model->update($byCode[$cKey], $payload);
                    $updated++;
                    continue;
                }

                // No code but the product name already exists → skip (can't upsert safely).
                if ($cKey === null && isset($byName[$nKey])) { $skipped++; continue; }

                // INSERT — apply create-time defaults for blank status/stock.
                $id = $this->persistProduct(array_merge($item, $base, [
                    'status' => $status ?? 'active',
                    'stock'  => $stock ?? 0,
                ]), $vendorId);
                if ($cKey !== null) $byCode[$cKey] = $id;
                $byName[$nKey] = $id;
                $created++;
            } catch (\Throwable $e) {
                $failed[] = ['row' => $line, 'name' => is_array($item) ? (string) ($item['name'] ?? '') : '', 'reason' => $e->getMessage()];
            }
        }

        $msg = "Created {$created}, updated {$updated}, skipped {$skipped}" . ($failed ? (', ' . count($failed) . ' failed') : '');
        return $this->ok([
            'created'      => $created,
            'updated'      => $updated,
            'skipped'      => $skipped,
            'failed_count' => count($failed),
            'failed'       => array_slice($failed, 0, 100),
            'total'        => count($items),
        ], $msg);
    }

    /**
     * Normalize the Material Master + comprehensive-catalog columns from a decoded
     * import row into a products-table payload fragment. Shared by persistProduct()
     * (insert) and the admin catalog import's update path so both write an identical
     * column set. Also computes discount_amount, and tax_amount when the sheet leaves
     * it blank — both stored-only, they never change the displayed selling price.
     */
    private function catalogColumns(array $d): array
    {
        $out = [];

        // Material Master columns (decimals / strings / dates).
        foreach (self::MM_DECIMALS as $f) $out[$f] = (isset($d[$f]) && is_numeric($d[$f])) ? (float) $d[$f] : null;
        foreach (self::MM_STRINGS as $f)  $out[$f] = (isset($d[$f]) && trim((string) $d[$f]) !== '') ? trim((string) $d[$f]) : null;
        foreach (self::MM_DATES as $f) {
            $ts = ! empty($d[$f]) ? strtotime((string) $d[$f]) : false;
            $out[$f] = $ts ? date('Y-m-d H:i:s', $ts) : null;
        }

        // Comprehensive catalog columns.
        foreach (self::CAT_DECIMALS as $f) $out[$f] = (isset($d[$f]) && is_numeric($d[$f])) ? (float) $d[$f] : null;
        foreach (self::CAT_INTS as $f)     $out[$f] = (isset($d[$f]) && is_numeric($d[$f])) ? (int) $d[$f] : null;
        foreach (self::CAT_STRINGS as $f)  $out[$f] = (isset($d[$f]) && trim((string) $d[$f]) !== '') ? trim((string) $d[$f]) : null;

        // discount_type → percentage | fixed (or null).
        $dt = mb_strtolower(trim((string) ($d['discount_type'] ?? '')));
        if (in_array($dt, ['percentage', 'percent', '%'], true))  $dt = 'percentage';
        elseif (in_array($dt, ['fixed', 'flat', 'amount'], true)) $dt = 'fixed';
        else                                                      $dt = null;
        $out['discount_type'] = $dt;

        // featured: blank → null (left unchanged on update); any explicit value → 0/1.
        $ff = mb_strtolower(trim((string) ($d['featured'] ?? '')));
        $out['featured'] = $ff === '' ? null : (in_array($ff, ['1', 'yes', 'true', 'y', 'featured', 'on'], true) ? 1 : 0);

        // gallery_images: array or delimited string of URLs → JSON array.
        $out['gallery_images'] = $this->normalizeGallery($d['gallery_images'] ?? null);

        // Computed amounts off the selling price (stored only).
        $price = isset($d['price']) && is_numeric($d['price']) ? (float) $d['price'] : 0.0;
        $dv    = $out['discount_value'];
        if ($dt === 'percentage' && $dv !== null)  $out['discount_amount'] = round($price * $dv / 100, 2);
        elseif ($dt === 'fixed' && $dv !== null)   $out['discount_amount'] = round(min($dv, $price), 2);

        // tax_amount only when the sheet didn't provide one (base = selling price).
        if ($out['tax_amount'] === null && $out['tax_percentage'] !== null) {
            $tp   = (float) $out['tax_percentage'];
            $incl = strpos(mb_strtolower((string) ($out['tax_type'] ?? '')), 'inclus') !== false;
            if ($incl) {
                $out['tax_amount'] = ($tp > -100) ? round($price - $price / (1 + $tp / 100), 2) : null;
            } else {
                $out['tax_amount'] = round($price * $tp / 100, 2);
            }
        }

        return $out;
    }

    /** Normalize a gallery value (array or `|`/newline/comma-delimited URLs) → JSON array, or null. */
    private function normalizeGallery($v): ?string
    {
        if (is_array($v)) {
            $parts = $v;
        } else {
            $s = trim((string) $v);
            if ($s === '') return null;
            $parts = preg_split('/[|\r\n]+/', $s);
            if (count($parts) === 1 && strpos($s, ',') !== false) $parts = explode(',', $s);
        }
        $urls = array_values(array_filter(array_map(static fn ($u) => trim((string) $u), $parts), static fn ($u) => $u !== ''));
        return $urls ? json_encode($urls, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null;
    }

    /**
     * Insert one product plus its variants from a (decoded) request item.
     * Shared by create() and bulkCreate(); caller resolves $vendorId + auth.
     */
    private function persistProduct(array $d, int $vendorId): int
    {
        $attrs    = isset($d['attributes']) ? $this->normalizeAttributes($d['attributes']) : null;
        $vTypes   = $this->normalizeVariantTypes($d['variant_types'] ?? null);
        $variants = $this->normalizeVariants($d['variants'] ?? null, $vTypes);
        $vImages  = $this->normalizeVariantImages($d['variant_images'] ?? null, $vTypes);
        $payload = [
            'vendor_id'          => $vendorId,
            'category_id'        => $d['category_id'] ?? null,
            'vendor_category_id' => isset($d['vendor_category_id']) ? (int) $d['vendor_category_id'] : null,
            'name'               => $d['name'],
            'description'        => $d['description'] ?? null,
            'price'              => $d['price'],
            'mrp'                => isset($d['mrp']) && $d['mrp'] !== '' ? (float) $d['mrp'] : null,
            'code'               => ! empty($d['code']) ? (string) $d['code'] : null,
            'barcode'            => ! empty($d['barcode']) ? (string) $d['barcode'] : null,
            'stock'              => $d['stock'] ?? 0,
            'has_variants'       => $variants ? 1 : 0,
            'variant_types'      => $vTypes ? json_encode($vTypes, JSON_UNESCAPED_UNICODE) : null,
            'variant_images'     => $vImages ? json_encode($vImages, JSON_UNESCAPED_UNICODE) : null,
            'image'              => $d['image'] ?? null,
            'attributes'         => $attrs !== null ? json_encode($attrs, JSON_UNESCAPED_UNICODE) : null,
            'status'             => $d['status'] ?? 'active',
        ];
        // Material Master + comprehensive catalog columns — only set when present
        // (a normal vendor create leaves them null). Single source of truth for
        // both this insert and the admin catalog import's update path.
        $payload = array_merge($payload, $this->catalogColumns($d));

        $id = (new ProductModel())->insert($payload, true);
        $this->syncVariants((int) $id, $variants);
        return (int) $id;
    }

    /** Update an existing product (fields + variants) from a decoded import item. */
    private function applyProductUpdate(int $id, array $d): void
    {
        $attrs    = isset($d['attributes']) ? $this->normalizeAttributes($d['attributes']) : null;
        $vTypes   = $this->normalizeVariantTypes($d['variant_types'] ?? null);
        $variants = $this->normalizeVariants($d['variants'] ?? null, $vTypes);
        $vImages  = $this->normalizeVariantImages($d['variant_images'] ?? null, $vTypes);
        (new ProductModel())->update($id, [
            'category_id'    => $d['category_id'] ?? null,
            'name'           => $d['name'],
            'description'    => $d['description'] ?? null,
            'price'          => $d['price'],
            'stock'          => $d['stock'] ?? 0,
            'has_variants'   => $variants ? 1 : 0,
            'variant_types'  => $vTypes ? json_encode($vTypes, JSON_UNESCAPED_UNICODE) : null,
            'variant_images' => $vImages ? json_encode($vImages, JSON_UNESCAPED_UNICODE) : null,
            'attributes'     => $attrs !== null ? json_encode($attrs, JSON_UNESCAPED_UNICODE) : null,
            'status'         => $d['status'] ?? 'active',
        ]);
        $this->syncVariants($id, $variants);
    }

    /**
     * Add or replace stock on an existing product without touching its other
     * details. Variant products are merged per-variant (matched by SKU, then by
     * option combination); brand-new combos are appended. Returns units added.
     */
    private function applyStockChange(int $id, array $row, array $d, string $mode): int
    {
        $pm = new ProductModel();
        $vm = new ProductVariantModel();
        $vTypes      = $this->normalizeVariantTypes($d['variant_types'] ?? null);
        $csvVariants = $this->normalizeVariants($d['variants'] ?? null, $vTypes);
        $existing    = $vm->where('product_id', $id)->findAll();

        // Plain product (no variants on either side): adjust the stock column.
        if (! $existing && ! $csvVariants) {
            $import = (int) ($d['stock'] ?? 0);
            $new    = $mode === 'add' ? (int) $row['stock'] + $import : $import;
            $pm->update($id, ['stock' => $new]);
            return $mode === 'add' ? $import : 0;
        }

        // Variant product: match each CSV combo to an existing variant.
        $bySku = [];
        $byOpts = [];
        foreach ($existing as $ev) {
            if (! empty($ev['sku'])) $bySku[mb_strtolower(trim((string) $ev['sku']))] = $ev;
            $byOpts[$this->optionsKey($ev['options'] ?? null)] = $ev;
        }
        $unitsAdded = 0;
        foreach ($csvVariants as $cv) {
            $match = null;
            $cvSku = mb_strtolower(trim((string) ($cv['sku'] ?? '')));
            if ($cvSku !== '' && isset($bySku[$cvSku]))               $match = $bySku[$cvSku];
            elseif (isset($byOpts[$this->optionsKey($cv['options'])])) $match = $byOpts[$this->optionsKey($cv['options'])];

            if ($match) {
                $new = $mode === 'add' ? (int) $match['stock'] + (int) $cv['stock'] : (int) $cv['stock'];
                $vm->update((int) $match['id'], ['stock' => $new]);
            } else {
                $vm->insert([
                    'product_id' => $id,
                    'name'       => $cv['name'],
                    'sku'        => $cv['sku'],
                    'options'    => json_encode($cv['options'], JSON_UNESCAPED_UNICODE),
                    'price'      => $cv['price'],
                    'stock'      => (int) $cv['stock'],
                    'image'      => $cv['image'],
                    'status'     => $cv['status'],
                ], false);
            }
            if ($mode === 'add') $unitsAdded += (int) $cv['stock'];
        }

        // Keep the product's declared variant axes in sync with any new combos.
        $merged = $this->mergeVariantTypes($this->decodeVariantTypes($row['variant_types'] ?? null), $vTypes);
        $pm->update($id, [
            'has_variants'  => 1,
            'variant_types' => $merged ? json_encode($merged, JSON_UNESCAPED_UNICODE) : null,
        ]);
        return $unitsAdded;
    }

    /** Axis-sorted, lowercased key for a variant option map. */
    private function optionsKey(mixed $options): string
    {
        $arr = is_array($options) ? $options : (is_string($options) ? (json_decode($options, true) ?: []) : []);
        ksort($arr);
        $parts = [];
        foreach ($arr as $k => $v) $parts[] = mb_strtolower(trim((string) $k)) . '=' . mb_strtolower(trim((string) $v));
        return implode('|', $parts);
    }

    /** Union two variant_types definitions (by axis name, options de-duplicated). */
    private function mergeVariantTypes(array $a, array $b): array
    {
        $out = [];
        foreach ([$a, $b] as $set) {
            foreach ($set as $vt) {
                $name = trim((string) ($vt['name'] ?? ''));
                if ($name === '') continue;
                if (! isset($out[$name])) $out[$name] = [];
                foreach (($vt['options'] ?? []) as $o) {
                    $o = trim((string) $o);
                    if ($o !== '' && ! in_array($o, $out[$name], true)) $out[$name][] = $o;
                }
            }
        }
        $res = [];
        foreach ($out as $name => $opts) $res[] = ['name' => $name, 'options' => $opts];
        return $res;
    }

    /** Drop attributes down to a flat key→scalar map. */
    private function normalizeAttributes(mixed $raw): ?array
    {
        if (! is_array($raw)) return null;
        $out = [];
        foreach ($raw as $k => $v) {
            if (! is_string($k) || $k === '') continue;
            if (is_array($v) || is_object($v)) continue; // reject nested structures
            if ($v === null) { $out[$k] = null; continue; }
            $out[$k] = is_bool($v) ? $v : (is_numeric($v) ? $v + 0 : (string) $v);
        }
        return $out;
    }

    /**
     * Normalize variant types definition.
     * Accepts: [{ name: string, options: string[] }, ...]
     */
    private function normalizeVariantTypes(mixed $raw): array
    {
        if (! is_array($raw)) return [];
        $out = [];
        foreach ($raw as $vt) {
            if (! is_array($vt)) continue;
            $name = trim((string) ($vt['name'] ?? ''));
            if ($name === '') continue;
            $rawOpts = $vt['options'] ?? [];
            $opts = is_array($rawOpts)
                ? array_values(array_filter(array_map(static fn ($s) => trim((string) $s), $rawOpts), static fn ($s) => $s !== ''))
                : [];
            if (! $opts) continue;
            $out[] = ['name' => $name, 'options' => array_values(array_unique($opts))];
        }
        return $out;
    }

    /**
     * Normalize variant combinations.
     * Accepts: [{ name?, sku?, options:{type→option}, price, stock, image?, status? }, ...]
     * Filters out rows whose options don't match the declared variant_types.
     */
    private function normalizeVariants(mixed $raw, array $vTypes): array
    {
        if (! is_array($raw) || ! $vTypes) return [];
        $axisOptions = [];
        foreach ($vTypes as $vt) $axisOptions[$vt['name']] = array_flip($vt['options']);
        $out = [];
        foreach ($raw as $v) {
            if (! is_array($v)) continue;
            $rawOpts = $v['options'] ?? null;
            if (! is_array($rawOpts) || ! $rawOpts) continue;
            $opts = [];
            $valid = true;
            foreach ($vTypes as $vt) {
                $axisName = $vt['name'];
                $picked   = isset($rawOpts[$axisName]) ? trim((string) $rawOpts[$axisName]) : '';
                if ($picked === '' || ! isset($axisOptions[$axisName][$picked])) { $valid = false; break; }
                $opts[$axisName] = $picked;
            }
            if (! $valid) continue;
            $name = trim((string) ($v['name'] ?? ''));
            if ($name === '') $name = implode(' + ', array_values($opts));
            $sku  = trim((string) ($v['sku'] ?? ''));
            $out[] = [
                'name'    => $name,
                'sku'     => $sku !== '' ? $sku : null,
                'options' => $opts,
                'price'   => (float) ($v['price'] ?? 0),
                'stock'   => (int) ($v['stock'] ?? 0),
                'image'   => isset($v['image']) && is_string($v['image']) && $v['image'] !== '' ? $v['image'] : null,
                'status'  => in_array(($v['status'] ?? 'active'), ['active', 'inactive'], true) ? ($v['status'] ?? 'active') : 'active',
            ];
        }
        return $out;
    }

    /**
     * Normalize per-axis-per-option image arrays.
     * Input: { axisName: { optionValue: [img, img, ...] | img } }
     * Output: same shape with arrays of non-empty strings only.
     * Strips entries for axes/options not present in the declared variant_types.
     */
    private function normalizeVariantImages(mixed $raw, array $vTypes): array
    {
        if (! is_array($raw) || ! $vTypes) return [];
        $axisOptions = [];
        foreach ($vTypes as $vt) $axisOptions[$vt['name']] = array_flip($vt['options']);
        $out = [];
        foreach ($raw as $axis => $byOption) {
            if (! is_string($axis) || ! isset($axisOptions[$axis]) || ! is_array($byOption)) continue;
            $axisOut = [];
            foreach ($byOption as $opt => $imgs) {
                if (! is_string($opt) || ! isset($axisOptions[$axis][$opt])) continue;
                $arr = is_array($imgs) ? $imgs : [$imgs];
                $clean = [];
                foreach ($arr as $img) {
                    if (is_string($img) && $img !== '') $clean[] = $img;
                }
                if ($clean) $axisOut[$opt] = $clean;
            }
            if ($axisOut) $out[$axis] = $axisOut;
        }
        return $out;
    }

    /** Replace the product's variant rows with the given set. Pass [] to clear. */
    private function syncVariants(int $productId, array $variants): void
    {
        $model = new ProductVariantModel();
        $model->where('product_id', $productId)->delete();
        foreach ($variants as $v) {
            $model->insert([
                'product_id' => $productId,
                'name'       => $v['name'],
                'sku'        => $v['sku'],
                'options'    => json_encode($v['options'], JSON_UNESCAPED_UNICODE),
                'price'      => $v['price'],
                'stock'      => $v['stock'],
                'image'      => $v['image'],
                'status'     => $v['status'],
            ], false);
        }
    }

    public function update(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        $model = new ProductModel();
        $row   = $model->find($id);
        if (! $row) return $this->fail('Not found', 404);
        if ($auth->role !== 'admin' && (int) $row['vendor_id'] !== (int) $auth->id) return $this->fail('Forbidden', 403);

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $payload = array_intersect_key($d, array_flip(['name', 'description', 'price', 'stock', 'image', 'status', 'category_id', 'vendor_category_id']));
        if (array_key_exists('attributes', $d)) {
            $attrs = $this->normalizeAttributes($d['attributes']);
            $payload['attributes'] = $attrs !== null ? json_encode($attrs, JSON_UNESCAPED_UNICODE) : null;
        }
        $variantTypesProvided  = array_key_exists('variant_types', $d);
        $variantsProvided      = array_key_exists('variants', $d);
        $variantImagesProvided = array_key_exists('variant_images', $d);
        if ($variantTypesProvided) {
            $vTypes = $this->normalizeVariantTypes($d['variant_types']);
            $payload['variant_types'] = $vTypes ? json_encode($vTypes, JSON_UNESCAPED_UNICODE) : null;
        }
        if ($variantsProvided) {
            // Need the latest declared types (either just-set or already on the row).
            $vTypesForCheck = isset($vTypes)
                ? $vTypes
                : $this->decodeVariantTypes($row['variant_types'] ?? null);
            $variants = $this->normalizeVariants($d['variants'], $vTypesForCheck);
            $payload['has_variants'] = $variants ? 1 : 0;
        }
        if ($variantImagesProvided) {
            $vTypesForImg = isset($vTypes)
                ? $vTypes
                : $this->decodeVariantTypes($row['variant_types'] ?? null);
            $vImages = $this->normalizeVariantImages($d['variant_images'], $vTypesForImg);
            $payload['variant_images'] = $vImages ? json_encode($vImages, JSON_UNESCAPED_UNICODE) : null;
        }
        if (! $payload && ! $variantsProvided) return $this->fail('Nothing to update', 422);
        if ($payload) $model->update($id, $payload);
        if ($variantsProvided) $this->syncVariants($id, $variants ?? []);
        return $this->ok(null, 'Updated');
    }

    /** Read variant_types JSON from a product row. */
    private function decodeVariantTypes(mixed $raw): array
    {
        if (is_array($raw)) return $raw;
        if (! is_string($raw) || $raw === '') return [];
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    public function delete(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        $model = new ProductModel();
        $row   = $model->find($id);
        if (! $row) return $this->fail('Not found', 404);
        if ($auth->role !== 'admin' && (int) $row['vendor_id'] !== (int) $auth->id) return $this->fail('Forbidden', 403);
        $model->delete($id);
        return $this->ok(null, 'Deleted');
    }
}
