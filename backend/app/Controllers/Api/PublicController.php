<?php

namespace App\Controllers\Api;

use App\Models\CategoryModel;
use App\Models\DistrictModel;
use App\Models\PincodeModel;
use App\Models\ProductModel;
use App\Models\ProductVariantModel;
use App\Models\StateModel;
use App\Models\TalukModel;
use App\Models\UserModel;
use App\Models\VariantTypeGroupModel;
use App\Models\VendorProfileModel;
use App\Services\PrescriptionPolicy;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * No-auth public endpoints for the landing pages.
 */
class PublicController extends BaseApiController
{
    /**
     * Resolve the vendor user-ids that serve a requested geo scope. Returns
     * null when no geo filter was supplied (= no scoping); otherwise a
     * (possibly empty) de-duplicated list of vendor user-ids.
     *
     * Besides the exact column match, this reconciles via the pincodes table:
     * a vendor whose profile only captured a pincode (taluk_id/district_id left
     * blank at registration) is still matched when that pincode belongs to the
     * requested taluk/district. Without this, such a vendor never appears in
     * its own taluk's results (BUG-012).
     */
    private function geoVendorIds(string $pincode, int $talukId, int $districtId, int $stateId): ?array
    {
        $clean = static fn (array $ids) => array_values(array_unique(array_map('intval', $ids)));

        if ($pincode !== '') {
            return $clean((new VendorProfileModel())->where('pincode', $pincode)->findColumn('user_id') ?: []);
        }
        if ($talukId > 0) {
            $ids  = (new VendorProfileModel())->where('taluk_id', $talukId)->findColumn('user_id') ?: [];
            $pins = (new PincodeModel())->where('taluk_id', $talukId)->findColumn('code') ?: [];
            if ($pins) {
                $ids = array_merge($ids, (new VendorProfileModel())->whereIn('pincode', $pins)->findColumn('user_id') ?: []);
            }
            return $clean($ids);
        }
        if ($districtId > 0) {
            $ids      = (new VendorProfileModel())->where('district_id', $districtId)->findColumn('user_id') ?: [];
            $talukIds = (new TalukModel())->where('district_id', $districtId)->findColumn('id') ?: [];
            if ($talukIds) {
                $pins = (new PincodeModel())->whereIn('taluk_id', $talukIds)->findColumn('code') ?: [];
                if ($pins) {
                    $ids = array_merge($ids, (new VendorProfileModel())->whereIn('pincode', $pins)->findColumn('user_id') ?: []);
                }
            }
            return $clean($ids);
        }
        if ($stateId > 0) {
            return $clean((new VendorProfileModel())->where('state_id', $stateId)->findColumn('user_id') ?: []);
        }
        return null;
    }

    public function home(): ResponseInterface
    {
        // Optional location scope (customer's chosen delivery location).
        // Filter featured products to vendors in that taluk/district/state.
        $talukId    = (int) $this->request->getGet('taluk_id');
        $districtId = (int) $this->request->getGet('district_id');
        $stateId    = (int) $this->request->getGet('state_id');

        $vendorIds = $this->geoVendorIds('', $talukId, $districtId, $stateId);

        $featuredQ = (new ProductModel())->where('status', 'active');
        if (is_array($vendorIds)) {
            if (empty($vendorIds)) {
                return $this->ok(['featured' => [], 'categories' => []]);
            }
            $featuredQ->whereIn('vendor_id', $vendorIds);
        }
        $featured = $featuredQ->orderBy('id', 'DESC')->findAll(8);
        $featured = $this->enrich($featured);
        $cats     = (new CategoryModel())->where('status', 'active')->findAll(8);
        return $this->ok(['featured' => $featured, 'categories' => $cats]);
    }

    public function products(): ResponseInterface
    {
        $q              = (string) $this->request->getGet('q');
        $catId          = (int)    $this->request->getGet('category_id');
        $vendorCatId    = (int)    $this->request->getGet('vendor_category_id');
        $vendorId       = (int)    $this->request->getGet('vendor_id');
        $pincode        = (string) $this->request->getGet('pincode');
        $stateId        = (int)    $this->request->getGet('state_id');
        $districtId     = (int)    $this->request->getGet('district_id');
        $talukId        = (int)    $this->request->getGet('taluk_id');
        $priceMin       = $this->request->getGet('price_min');
        $priceMax       = $this->request->getGet('price_max');
        $inStock        = $this->request->getGet('in_stock');
        $model          = (new ProductModel())->where('status', 'active');

        if ($q) {
            // Match the product name OR the vendor's shop/owner name, so a
            // customer can search by shop ("SF Shop") as well as product ("rice").
            //
            // Product-name matching is WORD-BOUNDARY, not a raw substring: the term
            // must START a word ("oil" -> "Hair Oil", "Oil Filter") so it does not
            // match mid-word ("oil" living inside "tOILet"). Vendor matching stays a
            // plain contains-search.
            $vNameIds = (new UserModel())->where('role', 'vendor')->like('name', $q)->findColumn('id') ?: [];
            $vShopIds = (new VendorProfileModel())->like('shop_name', $q)->findColumn('user_id') ?: [];
            $vIds     = array_values(array_unique(array_merge($vNameIds, $vShopIds)));
            $model->groupStart()
                  ->like('name', $q, 'after')          // name starts with the term  -> LIKE 'oil%'
                  ->orLike('name', ' ' . $q, 'both');   // a later word starts with it -> LIKE '% oil%'
            if (! empty($vIds)) $model->orWhereIn('vendor_id', $vIds);
            $model->groupEnd();

            // Relevance ranking: exact name > starts-with > word-start > matched
            // only via vendor name, then alphabetical. Literals are escaped, so the
            // raw ORDER BY is injection-safe. The "id DESC" below stays as the final
            // tiebreak.
            $db      = db_connect();
            $eqLit   = $db->escape($q);
            $pfxLit  = $db->escape($q . '%');
            $wordLit = $db->escape('% ' . $q . '%');
            $model->orderBy(
                'CASE'
                . " WHEN LOWER(name) = LOWER($eqLit) THEN 0"
                . " WHEN LOWER(name) LIKE LOWER($pfxLit) THEN 1"
                . " WHEN LOWER(name) LIKE LOWER($wordLit) THEN 2"
                . ' ELSE 3 END',
                'ASC',
                false
            );
            $model->orderBy('name', 'ASC');
        }
        if ($catId)     $model->where('category_id', $catId);
        if ($vendorId)  $model->where('vendor_id', $vendorId);
        if ($priceMin !== null && $priceMin !== '') $model->where('price >=', (float) $priceMin);
        if ($priceMax !== null && $priceMax !== '') $model->where('price <=', (float) $priceMax);
        if ($inStock === '1' || $inStock === 1)     $model->where('stock >', 0);

        // Vendor-category scope: a product matches if its own vendor_category_id
        // matches, OR its product-category's vendor_category_id matches.
        if ($vendorCatId > 0) {
            $catIdsForVc = (new CategoryModel())->where('vendor_category_id', $vendorCatId)->findColumn('id') ?: [];
            $model->groupStart()
                  ->where('vendor_category_id', $vendorCatId)
                  ->orGroupStart();
            if (! empty($catIdsForVc)) {
                $model->whereIn('category_id', $catIdsForVc);
            } else {
                $model->where('1=0');
            }
            $model->groupEnd()->groupEnd();
        }

        // Geo scoping: walk pincode → taluk → district → state (most specific wins).
        $geoVendorIds = $this->geoVendorIds($pincode, $talukId, $districtId, $stateId);
        if (is_array($geoVendorIds)) {
            if (empty($geoVendorIds)) {
                return $this->ok(['items' => [], 'categories' => (new CategoryModel())->where('status', 'active')->findAll()]);
            }
            $model->whereIn('vendor_id', $geoVendorIds);
        }

        // Pagination (for the customer "All products" infinite scroll). Backward
        // compatible: callers that omit `page` get page 1 with the default 60.
        $page  = max(1, (int) $this->request->getGet('page'));
        $limit = (int) $this->request->getGet('limit');
        $limit = $limit > 0 ? min($limit, 100) : 60;
        $offset = ($page - 1) * $limit;

        $total = $model->countAllResults(false);
        $items = $model->orderBy('id', 'DESC')->findAll($limit, $offset);
        return $this->ok([
            'items'      => $this->enrich($items),
            'categories' => (new CategoryModel())->where('status', 'active')->findAll(),
            'page'       => $page,
            'limit'      => $limit,
            'total'      => $total,
            'has_more'   => ($offset + count($items)) < $total,
        ]);
    }

    public function product(int $id): ResponseInterface
    {
        $row = (new ProductModel())->find($id);
        if (! $row) return $this->fail('Not found', 404);
        $enriched = $this->enrich([$row]);
        $variants = (new ProductVariantModel())->where('product_id', $id)->where('status', 'active')->findAll();
        $variants = array_map(static function ($v) {
            $raw = $v['options'] ?? null;
            $v['options'] = is_string($raw) ? (json_decode($raw, true) ?: []) : (is_array($raw) ? $raw : []);
            $v['price']   = (float) ($v['price'] ?? 0);
            $v['stock']   = (int) ($v['stock'] ?? 0);
            // Per-variant MRP for the detail strikethrough / % OFF (null when not discounted).
            $v['mrp']     = (isset($v['mrp']) && (float) $v['mrp'] > (float) $v['price']) ? (float) $v['mrp'] : null;
            return $v;
        }, $variants);

        $rawTypes = $row['variant_types'] ?? null;
        $variantTypes = is_string($rawTypes) ? (json_decode($rawTypes, true) ?: []) : (is_array($rawTypes) ? $rawTypes : []);
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

    /**
     * Public geo dump for the customer-side location picker.
     * Returns active states / districts / taluks in one go — small enough
     * that loading them all is cheaper than chained API calls.
     */
    public function locations(): ResponseInterface
    {
        $states    = (new StateModel())->where('status', 'active')->orderBy('name', 'ASC')->findAll();
        $districts = (new DistrictModel())->where('status', 'active')->orderBy('name', 'ASC')->findAll();
        $taluks    = (new TalukModel())->where('status', 'active')->orderBy('name', 'ASC')->findAll();
        return $this->ok([
            'states'    => array_map(static fn ($s) => ['id' => (int) $s['id'], 'name' => $s['name']], $states),
            'districts' => array_map(static fn ($d) => ['id' => (int) $d['id'], 'state_id' => (int) ($d['state_id'] ?? 0), 'name' => $d['name']], $districts),
            'taluks'    => array_map(static fn ($t) => ['id' => (int) $t['id'], 'district_id' => (int) ($t['district_id'] ?? 0), 'name' => $t['name']], $taluks),
        ]);
    }

    public function vendors(): ResponseInterface
    {
        $pincode     = (string) $this->request->getGet('pincode');
        $talukId     = (int) $this->request->getGet('taluk_id');
        $districtId  = (int) $this->request->getGet('district_id');
        $stateId     = (int) $this->request->getGet('state_id');
        $vendorCatId = (int) $this->request->getGet('vendor_category_id');

        $vendorIds = $this->geoVendorIds($pincode, $talukId, $districtId, $stateId);
        if (is_array($vendorIds) && empty($vendorIds)) return $this->ok(['items' => []]);

        // Browse by shop category: keep only shops in the chosen vendor category.
        if ($vendorCatId > 0) {
            $catIds = (new VendorProfileModel())->where('vendor_category_id', $vendorCatId)->findColumn('user_id') ?: [];
            if (empty($catIds)) return $this->ok(['items' => []]);
            $vendorIds = $vendorIds === null ? $catIds : array_values(array_intersect($vendorIds, $catIds));
            if (empty($vendorIds)) return $this->ok(['items' => []]);
        }

        $users = (new UserModel())->where('role', 'vendor')->where('status', 'active');
        if ($vendorIds !== null) $users->whereIn('id', $vendorIds);
        $rows = $users->orderBy('id', 'DESC')->findAll(100);

        $ids      = array_map(static fn ($u) => (int) $u['id'], $rows);
        $profiles = $ids ? (new VendorProfileModel())->whereIn('user_id', $ids)->findAll() : [];
        $byId     = []; foreach ($profiles as $p) $byId[(int) $p['user_id']] = $p;

        // Pharmacy/medicine shops accept a prescription-only order (no item pick).
        $rxCatIds = PrescriptionPolicy::categoryIds();
        $items = array_map(static function ($u) use ($byId, $rxCatIds) {
            $p = $byId[(int) $u['id']] ?? [];
            return [
                'id'        => (int) $u['id'],
                'name'      => $u['name'],
                'mobile'    => $u['mobile_number'],
                'shop_name' => $p['shop_name'] ?? null,
                'address'   => $p['address']   ?? null,
                'area'      => $p['area']      ?? null,
                'pincode'   => $p['pincode']   ?? null,
                'image'     => (($p['image_status'] ?? '') === 'inactive') ? null : ($p['image'] ?? null),
                'gst'       => $p['gst']       ?? null,
                'requires_prescription' => in_array((int) ($p['vendor_category_id'] ?? 0), $rxCatIds, true),
            ];
        }, $rows);
        return $this->ok(['items' => $items]);
    }

    /**
     * Resolve a referral code (= referrer's mobile number) to the referrer's
     * name, for the registration page to show "Referred by ...". Public: the
     * register page runs before login. Returns name=null when no active
     * customer matches that mobile.
     */
    public function referrer(string $code): ResponseInterface
    {
        $ref = (new UserModel())
            ->where('mobile_number', preg_replace('/\D/', '', $code))
            ->where('role', 'customer')
            ->where('status', 'active')
            ->first();

        return $this->ok(['name' => $ref['name'] ?? null]);
    }

    /**
     * Add vendor_name + category_name + has_variants to product rows for
     * shop list pages that need to render them in one trip.
     */
    private function enrich(array $rows): array
    {
        if (! $rows) return [];
        $catIds    = array_unique(array_filter(array_map(static fn ($r) => (int) ($r['category_id'] ?? 0), $rows)));
        $vendorIds = array_unique(array_filter(array_map(static fn ($r) => (int) ($r['vendor_id']   ?? 0), $rows)));
        $cats      = $catIds    ? (new CategoryModel())->whereIn('id', $catIds)->findAll() : [];
        $vendors   = $vendorIds ? (new UserModel())->whereIn('id', $vendorIds)->findAll() : [];
        $catName   = []; foreach ($cats    as $c) $catName[(int) $c['id']] = $c['name'];
        $vendName  = []; foreach ($vendors as $v) $vendName[(int) $v['id']] = $v['name'];
        $vendorProfiles = $vendorIds ? (new VendorProfileModel())->whereIn('user_id', $vendorIds)->findAll() : [];
        $shopName  = []; foreach ($vendorProfiles as $p) $shopName[(int) $p['user_id']] = $p['shop_name'];

        // Default (cheapest in-stock active) variant per product that has variants —
        // lets list/tile screens add to cart in one click without making the user
        // open the detail page just to pick a variant.
        $variantProductIds = [];
        foreach ($rows as $r) {
            if ((int) ($r['has_variants'] ?? 0) === 1 && ! empty($r['id'])) {
                $variantProductIds[] = (int) $r['id'];
            }
        }
        $defaultVariant = [];
        $variantInfo    = [];   // pid => [price (cheapest in-stock), mrp, min, max]
        if ($variantProductIds) {
            // ORDER puts in-stock variants first (stock > 0 → false → 0 → sorts before
            // stock = 0 → true → 1), then cheapest, then oldest. The third arg `false`
            // tells the query builder to leave the expression unescaped.
            $variants = (new ProductVariantModel())
                ->whereIn('product_id', $variantProductIds)
                ->where('status', 'active')
                ->orderBy('product_id', 'ASC')
                ->orderBy('(stock = 0)', 'ASC', false)
                ->orderBy('price', 'ASC')
                ->orderBy('id', 'ASC')
                ->findAll();
            foreach ($variants as $v) {
                $pid = (int) ($v['product_id'] ?? 0);
                $p   = (float) ($v['price'] ?? 0);
                if (! isset($defaultVariant[$pid])) {
                    // First row = cheapest in-stock active variant → card price + offer.
                    $defaultVariant[$pid] = (int) $v['id'];
                    $variantInfo[$pid] = ['price' => $p, 'mrp' => isset($v['mrp']) ? (float) $v['mrp'] : 0.0, 'min' => $p, 'max' => $p];
                } elseif ($p > $variantInfo[$pid]['max']) {
                    $variantInfo[$pid]['max'] = $p;
                }
            }
        }

        return array_map(static function ($r) use ($catName, $vendName, $shopName, $defaultVariant, $variantInfo) {
            $rawAttrs = $r['attributes'] ?? null;
            $attrs    = is_string($rawAttrs) ? (json_decode($rawAttrs, true) ?: null) : (is_array($rawAttrs) ? $rawAttrs : null);
            $pid   = (int) ($r['id'] ?? 0);
            $vi    = $variantInfo[$pid] ?? null;
            $isVar = (int) ($r['has_variants'] ?? 0) === 1 && $vi !== null;

            // Card offer: the cheapest variant's price + MRP (variant product), else
            // the product's own price/MRP. The client derives % OFF from old_price.
            $price    = $isVar ? $vi['price'] : (float) ($r['price'] ?? 0);
            $cheapMrp = $isVar ? $vi['mrp']   : (float) ($r['mrp'] ?? 0);
            $oldPrice = $cheapMrp > $price ? $cheapMrp : null;

            // Variant axes ("4 sizes", "2 colours") for the listing-card hint.
            $axes = [];
            if ($isVar) {
                $rawTypes = $r['variant_types'] ?? null;
                $vtypes   = is_string($rawTypes) ? (json_decode($rawTypes, true) ?: []) : (is_array($rawTypes) ? $rawTypes : []);
                foreach ($vtypes as $ax) {
                    $nm   = trim((string) ($ax['name'] ?? ''));
                    $opts = is_array($ax['options'] ?? null)
                        ? array_values(array_unique(array_filter(array_map(static fn ($o) => trim((string) $o), $ax['options']), static fn ($o) => $o !== '')))
                        : [];
                    // Include the actual option VALUES (e.g. ["100ml"]) so the card
                    // can show the real size/colour names instead of "1 size".
                    if ($nm !== '' && count($opts) > 0) $axes[] = ['name' => $nm, 'count' => count($opts), 'options' => $opts];
                }
            }

            return array_merge($r, [
                'category_name'      => $catName[(int) ($r['category_id'] ?? 0)]  ?? null,
                'vendor_name'        => $shopName[(int) ($r['vendor_id'] ?? 0)] ?? $vendName[(int) ($r['vendor_id'] ?? 0)] ?? null,
                'price'              => $price,
                'old_price'          => $oldPrice,
                'min_price'          => $isVar ? $vi['min'] : null,
                'max_price'          => $isVar ? $vi['max'] : null,
                'variant_axes'       => $axes,
                'stock'              => (int)   ($r['stock'] ?? 0),
                'has_variants'       => (bool)  ($r['has_variants'] ?? 0),
                'default_variant_id' => $defaultVariant[$pid] ?? null,
                'attributes'         => $attrs,
            ]);
        }, $rows);
    }
}
