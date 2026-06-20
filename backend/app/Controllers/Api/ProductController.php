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
            // Per-variant MRP for the detail strikethrough/% OFF (null when not discounted).
            $v['mrp']     = (isset($v['mrp']) && (float) $v['mrp'] > (float) $v['price']) ? (float) $v['mrp'] : null;
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
        $catParent = []; foreach ($cats     as $c) $catParent[(int) $c['id']]    = isset($c['parent_id']) && $c['parent_id'] !== null ? (int) $c['parent_id'] : null;
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
        return array_map(static function ($r) use ($catName, $catParent, $vendName, $shopName, $variantsByProduct) {
            $rawAttrs = $r['attributes'] ?? null;
            $attrs    = is_string($rawAttrs) ? (json_decode($rawAttrs, true) ?: null) : (is_array($rawAttrs) ? $rawAttrs : null);
            $rawTypes = $r['variant_types'] ?? null;
            $vTypes   = is_string($rawTypes) ? (json_decode($rawTypes, true) ?: []) : (is_array($rawTypes) ? $rawTypes : []);
            $rawImgs  = $r['variant_images'] ?? null;
            $vImgs    = is_string($rawImgs) ? (json_decode($rawImgs, true) ?: []) : (is_array($rawImgs) ? $rawImgs : []);
            return array_merge($r, [
                'category_name'      => $catName[(int) ($r['category_id'] ?? 0)]  ?? null,
                'category_parent_id' => $catParent[(int) ($r['category_id'] ?? 0)] ?? null,
                'vendor_name'    => $shopName[(int) ($r['vendor_id'] ?? 0)] ?? $vendName[(int) ($r['vendor_id'] ?? 0)] ?? null,
                'price'          => (float) ($r['price'] ?? 0),
                // Strikethrough MRP for the customer card (₹offer / ₹mrp / N% OFF). Only when mrp > price.
                'old_price'      => (isset($r['mrp']) && (float) $r['mrp'] > (float) ($r['price'] ?? 0)) ? (float) $r['mrp'] : null,
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
        $d['category_id'] = $this->applySubCategory($d);
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
     * The frontend chunks large catalogs into per-group calls and aggregates this.
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

        [$summary, $msg] = $this->runCatalogImport($vendorId, $items);
        return $this->ok($summary, $msg);
    }

    /**
     * Vendor self-import — the same comprehensive engine scoped to the logged-in
     * vendor (no vendor picker; they import into their own catalog).
     */
    public function vendorImport(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'vendor') return $this->fail('Forbidden', 403);

        $d     = $this->request->getJSON(true) ?? $this->request->getPost();
        $items = $d['items'] ?? null;
        if (! is_array($items) || ! $items) return $this->fail('No rows to import', 422);
        if (count($items) > 2000)           return $this->fail('Too many rows (max 2000 per request)', 422);

        [$summary, $msg] = $this->runCatalogImport((int) $auth->id, $items);
        return $this->ok($summary, $msg);
    }

    /**
     * Universal, attribute-agnostic catalog import engine (adminImport + vendorImport).
     * Each item is a product GROUP keyed by item_code:
     *   { code, name, category, sub_category, brand, hsn_code, description, status,
     *     featured, image, tax_type, tax_percentage, price?, mrp?, stock?,
     *     variants: [ { sku, options:{<attr>:<val>…}, price, mrp, stock, barcode } ] }
     * Variant attributes are whatever keys appear in `options` — the engine never
     * hardcodes Color/Size/RAM; variant_types (axes) are derived from their union.
     * Product upserts by code (never via persistProduct/syncVariants → no wipe);
     * variants merge by sku (append/update, never delete). discount is computed from
     * mrp vs price. Bad groups are reported but never abort the rest.
     *
     * @return array{0: array, 1: string} [summary, message]
     */
    private function runCatalogImport(int $vendorId, array $items): array
    {
        $pm       = new ProductModel();
        $catModel = new CategoryModel();

        // Category resolver: find/create by (parent, name), cached for the run.
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
            $id = (int) $catModel->insert(['name' => $name, 'parent_id' => $parentId ?: null, 'status' => 'active'], true);
            $catMap[$key] = $id;
            return $id;
        };

        // Existing products for THIS batch only (scale): look up by the codes present,
        // not the whole vendor catalog. ci collation makes whereIn case-insensitive.
        $rawCodes = [];
        foreach ($items as $it) {
            if (is_array($it)) { $c = trim((string) ($it['code'] ?? '')); if ($c !== '') $rawCodes[] = $c; }
        }
        $byCode = []; // lower(code) => full product row
        if ($rawCodes) {
            foreach ($pm->where('vendor_id', $vendorId)->whereIn('code', array_values(array_unique($rawCodes)))->findAll() as $p) {
                $byCode[mb_strtolower(trim((string) $p['code']))] = $p;
            }
        }

        $prodCreated = 0; $prodUpdated = 0; $prodSkipped = 0; $varCreated = 0; $varUpdated = 0; $failed = [];

        foreach (array_values($items) as $i => $item) {
            $line = $i + 1;
            try {
                if (! is_array($item)) { $failed[] = ['row' => $line, 'name' => '', 'reason' => 'Invalid row']; continue; }
                $name = trim((string) ($item['name'] ?? ''));
                $code = trim((string) ($item['code'] ?? ''));
                if ($name === '') { $failed[] = ['row' => $line, 'name' => '', 'reason' => 'product_name required']; continue; }
                if ($code === '') { $failed[] = ['row' => $line, 'name' => $name, 'reason' => 'item_code required']; continue; }

                // Normalize variants (drop ones without a valid price).
                $variants = [];
                foreach (is_array($item['variants'] ?? null) ? $item['variants'] : [] as $rv) {
                    if (! is_array($rv)) continue;
                    $vp = $rv['price'] ?? null;
                    if (! is_numeric($vp) || (float) $vp < 0) continue;
                    $opts = [];
                    foreach (is_array($rv['options'] ?? null) ? $rv['options'] : [] as $k => $val) {
                        $k = trim((string) $k); $val = trim((string) $val);
                        if ($k !== '' && $val !== '') $opts[$k] = $val;
                    }
                    $variants[] = [
                        'sku'     => trim((string) ($rv['sku'] ?? '')),
                        'options' => $opts,
                        'price'   => (float) $vp,
                        'mrp'     => isset($rv['mrp']) && is_numeric($rv['mrp']) ? (float) $rv['mrp'] : null,
                        'stock'   => isset($rv['stock']) && is_numeric($rv['stock']) ? (int) $rv['stock'] : 0,
                        'barcode' => trim((string) ($rv['barcode'] ?? '')) !== '' ? trim((string) $rv['barcode']) : null,
                        'weight'  => isset($rv['weight']) && is_numeric($rv['weight']) ? (float) $rv['weight'] : null,
                        'name'    => trim((string) ($rv['name'] ?? '')),
                    ];
                }
                $axes        = $this->deriveAxes($variants);
                $hasVariants = $variants && $axes;   // real variants only when there are axes (avoids phantom-variant carts)

                // Product-level price/mrp/stock: min/sum across variants, else the group row.
                if ($hasVariants) {
                    $price = min(array_map(static fn ($v) => $v['price'], $variants));
                    $mrps  = array_values(array_filter(array_map(static fn ($v) => $v['mrp'], $variants), static fn ($m) => $m !== null));
                    $mrp   = $mrps ? min($mrps) : null;
                    $stock = array_sum(array_map(static fn ($v) => $v['stock'], $variants));
                } else {
                    $price = $item['price'] ?? null;
                    if (! is_numeric($price) || (float) $price < 0) { $failed[] = ['row' => $line, 'name' => $name, 'reason' => 'price/offer_price required']; continue; }
                    $price = (float) $price;
                    $mrp   = isset($item['mrp']) && is_numeric($item['mrp']) ? (float) $item['mrp'] : null;
                    $stock = isset($item['stock']) && is_numeric($item['stock']) ? (int) $item['stock'] : 0;
                }
                [$discPct, $discAmt] = $this->computeDiscount($mrp, $price);

                // Category → Sub Category.
                $catId      = null;
                $parentName = trim((string) ($item['category'] ?? ''));
                $subName    = trim((string) ($item['sub_category'] ?? ''));
                if ($parentName !== '') {
                    $catId = $resolveCat($parentName, 0);
                    if ($subName !== '' && $catId) { $sid = $resolveCat($subName, $catId); if ($sid) $catId = $sid; }
                } elseif ($subName !== '') {
                    $catId = $resolveCat($subName, 0);
                }

                $statusRaw = mb_strtolower(trim((string) ($item['status'] ?? '')));
                $status    = $statusRaw === '' ? null : (in_array($statusRaw, ['inactive', '0', 'no', 'disabled', 'off'], true) ? 'inactive' : 'active');

                $base = [
                    'category_id'      => $catId,
                    'name'             => $name,
                    'description'      => trim((string) ($item['description'] ?? '')) !== '' ? trim((string) $item['description']) : null,
                    'price'            => $price,
                    'mrp'              => $mrp,
                    'code'             => $code,
                    'barcode'          => trim((string) ($item['barcode'] ?? '')) !== '' ? trim((string) $item['barcode']) : null,
                    'image'            => ! empty($item['image']) ? trim((string) $item['image']) : null,
                    'status'           => $status,
                    'stock'            => $stock,
                    'has_variants'     => $hasVariants ? 1 : 0,
                    'discount_percent' => $discPct,
                    'discount_amount'  => $discAmt,
                ];
                // Catalog extras (brand, hsn_code, tax_*, featured, gallery…) then base wins.
                $full = array_merge($this->catalogColumns($item), $base);

                $cKey     = mb_strtolower($code);
                $existing = $byCode[$cKey] ?? null;

                if ($existing) {
                    $productId = (int) $existing['id'];
                    // Strip nulls so blank cells don't wipe, but always (re)set these.
                    $always  = ['name', 'price', 'has_variants', 'category_id', 'discount_percent', 'discount_amount', 'mrp'];
                    $payload = array_filter($full, static fn ($v, $k) => $v !== null || in_array($k, $always, true), ARRAY_FILTER_USE_BOTH);
                    $pm->update($productId, $payload);
                    $prodUpdated++;
                } else {
                    $full['vendor_id']          = $vendorId;
                    $full['vendor_category_id'] = isset($item['vendor_category_id']) ? (int) $item['vendor_category_id'] : null;
                    $full['status'] = $full['status'] ?? 'active';
                    $productId = (int) $pm->insert($full, true);
                    $byCode[$cKey] = ['id' => $productId, 'variant_types' => null];
                    $prodCreated++;
                }

                if ($hasVariants) {
                    $existingTypes = $this->decodeVariantTypes($existing['variant_types'] ?? null);
                    $mergedTypes   = $this->unionVariantTypes($existingTypes, $axes);
                    $pm->update($productId, ['variant_types' => json_encode($mergedTypes, JSON_UNESCAPED_UNICODE), 'has_variants' => 1]);
                    [$vc, $vu] = $this->mergeVariantsBySku($productId, $code, $variants);
                    $varCreated += $vc; $varUpdated += $vu;
                    // keep the cached row's types fresh for repeat groups in this batch
                    $byCode[$cKey]['variant_types'] = json_encode($mergedTypes, JSON_UNESCAPED_UNICODE);
                }
            } catch (\Throwable $e) {
                $failed[] = ['row' => $line, 'name' => is_array($item) ? (string) ($item['name'] ?? '') : '', 'reason' => $e->getMessage()];
            }
        }

        $msg = "Products: {$prodCreated} new / {$prodUpdated} updated; Variants: {$varCreated} new / {$varUpdated} updated"
            . ($failed ? (', ' . count($failed) . ' failed') : '');
        return [[
            'products'     => ['created' => $prodCreated, 'updated' => $prodUpdated, 'skipped' => $prodSkipped],
            'variants'     => ['created' => $varCreated, 'updated' => $varUpdated],
            // flat aliases for backward-compatible clients
            'created'      => $prodCreated,
            'updated'      => $prodUpdated,
            'skipped'      => $prodSkipped,
            'failed_count' => count($failed),
            'failed'       => array_slice($failed, 0, 100),
            'total'        => count($items),
        ], $msg];
    }

    /** Discount % + amount from mrp vs price (offer). [null,null] when no discount. */
    private function computeDiscount(?float $mrp, ?float $price): array
    {
        if ($mrp !== null && $price !== null && $mrp > 0 && $mrp > $price) {
            return [round(($mrp - $price) / $mrp * 100, 2), round($mrp - $price, 2)];
        }
        return [null, null];
    }

    /** Derive variant axes [{name,options[]}] from the union of variants' option maps. */
    private function deriveAxes(array $variants): array
    {
        $order = []; $opts = [];
        foreach ($variants as $v) {
            foreach (($v['options'] ?? []) as $axis => $val) {
                $axis = trim((string) $axis); $val = trim((string) $val);
                if ($axis === '' || $val === '') continue;
                if (! isset($opts[$axis])) { $opts[$axis] = []; $order[] = $axis; }
                $opts[$axis][$val] = true;
            }
        }
        $out = [];
        foreach ($order as $axis) $out[] = ['name' => $axis, 'options' => array_keys($opts[$axis])];
        return $out;
    }

    /** Union two variant_types lists (merge options per axis, first-seen order). */
    private function unionVariantTypes(array $existing, array $incoming): array
    {
        $byName = []; $order = [];
        foreach ([$existing, $incoming] as $set) {
            foreach (is_array($set) ? $set : [] as $t) {
                $n = trim((string) ($t['name'] ?? ''));
                if ($n === '') continue;
                if (! isset($byName[$n])) { $byName[$n] = []; $order[] = $n; }
                foreach (($t['options'] ?? []) as $o) { $o = trim((string) $o); if ($o !== '') $byName[$n][$o] = true; }
            }
        }
        $out = [];
        foreach ($order as $n) $out[] = ['name' => $n, 'options' => array_keys($byName[$n])];
        return $out;
    }

    /** Append/update product_variants by sku (never delete). Returns [created, updated]. */
    private function mergeVariantsBySku(int $productId, string $code, array $variants): array
    {
        $vm = new ProductVariantModel();
        $existing = [];
        foreach ($vm->where('product_id', $productId)->findAll() as $ev) {
            if (! empty($ev['sku'])) $existing[mb_strtolower(trim((string) $ev['sku']))] = (int) $ev['id'];
        }
        $created = 0; $updated = 0; $toInsert = []; $insertIdx = [];
        foreach ($variants as $v) {
            $sku  = $v['sku'] !== '' ? $v['sku'] : $this->genVariantSku($code, $v['options']);
            $name = $v['name'] !== '' ? $v['name'] : ($v['options'] ? implode(' + ', array_values($v['options'])) : $sku);
            $row  = [
                'product_id' => $productId,
                'name'       => mb_substr($name, 0, 100), // product_variants.name is VARCHAR(100)
                'sku'        => $sku,
                'options'    => json_encode($v['options'], JSON_UNESCAPED_UNICODE),
                'price'      => $v['price'],
                'mrp'        => $v['mrp'],
                'stock'      => $v['stock'],
                'barcode'    => $v['barcode'],
                'weight'     => $v['weight'] ?? null,
                'status'     => 'active',
            ];
            $sKey = mb_strtolower(trim($sku));
            if (isset($existing[$sKey]) && $existing[$sKey] > 0) {
                $vm->update($existing[$sKey], $row);   // existing DB row → update
                $updated++;
            } elseif (isset($insertIdx[$sKey])) {
                $toInsert[$insertIdx[$sKey]] = $row;   // duplicate sku within this batch → overwrite the queued insert
            } else {
                $insertIdx[$sKey] = count($toInsert);
                $toInsert[]       = $row;
                $created++;
            }
        }
        if ($toInsert) $vm->insertBatch(array_values($toInsert));
        return [$created, $updated];
    }

    /** Deterministic sku from item_code + option values when a row has no sku. */
    private function genVariantSku(string $code, array $options): string
    {
        $base  = $code !== '' ? $code : 'VAR';
        $parts = array_values(array_filter(array_map(
            static fn ($v) => strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $v)),
            array_values($options),
        ), static fn ($p) => $p !== ''));
        $suffix = $parts ? implode('-', $parts) : strtoupper(substr(md5(json_encode($options)), 0, 6));
        return $base . '-' . $suffix;
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
     * Effective category_id for a request: when a non-empty sub_category is given
     * alongside a category_id, the product points at a (find-or-created) child
     * category under that parent. Returns the leaf id, else the given category_id.
     */
    private function applySubCategory(array $d): ?int
    {
        $catId = isset($d['category_id']) && $d['category_id'] !== '' ? (int) $d['category_id'] : null;
        $sub   = trim((string) ($d['sub_category'] ?? ''));
        if ($catId && $sub !== '') {
            return $this->resolveSubCategory($catId, $sub);
        }
        return $catId;
    }

    /** Find or create a sub-category by name under a parent category; returns its id. */
    private function resolveSubCategory(int $parentId, string $name): int
    {
        $name = trim($name);
        $cm   = new CategoryModel();
        $existing = $cm->where('parent_id', $parentId)->where('name', $name)->first();
        if ($existing) return (int) $existing['id'];
        return (int) $cm->insert([
            'name'      => $name,
            'parent_id' => $parentId,
            'status'    => 'active',
        ], true);
    }

    /**
     * Merge mrp/code/barcode + comprehensive catalog columns into an update
     * payload, applying ONLY keys actually present in $d — so a partial PATCH
     * (e.g. a status-only toggle) never null-wipes other fields. Computed
     * discount/tax amounts ride along only when their inputs were sent.
     */
    private function mergeCatalogForUpdate(array $payload, array $d): array
    {
        if (array_key_exists('mrp', $d))     $payload['mrp']     = is_numeric($d['mrp']) ? (float) $d['mrp'] : null;
        if (array_key_exists('code', $d))    $payload['code']    = trim((string) $d['code']) !== '' ? trim((string) $d['code']) : null;
        if (array_key_exists('barcode', $d)) $payload['barcode'] = trim((string) $d['barcode']) !== '' ? trim((string) $d['barcode']) : null;

        $cat     = $this->catalogColumns($d);
        $catKeys = array_merge(
            self::MM_DECIMALS, self::MM_STRINGS, self::MM_DATES,
            self::CAT_DECIMALS, self::CAT_INTS, self::CAT_STRINGS,
            ['discount_type', 'featured', 'gallery_images'],
        );
        foreach ($catKeys as $k) {
            if (array_key_exists($k, $d)) $payload[$k] = $cat[$k];
        }
        if (array_key_exists('discount_value', $d) || array_key_exists('discount_type', $d)) $payload['discount_amount'] = $cat['discount_amount'];
        if (array_key_exists('tax_percentage', $d)  || array_key_exists('tax_type', $d))     $payload['tax_amount']      = $cat['tax_amount'];

        return $payload;
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
        if (array_key_exists('category_id', $d)) {
            $d['category_id'] = $this->applySubCategory($d);
        }
        $payload = array_intersect_key($d, array_flip(['name', 'description', 'price', 'stock', 'image', 'status', 'category_id', 'vendor_category_id']));

        $payload = $this->mergeCatalogForUpdate($payload, $d);

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
