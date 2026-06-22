<?php

namespace App\Services;

use App\Models\CategoryModel;
use App\Models\VendorCategoryModel;

/**
 * GST (tax) breakup helper — BUG-014.
 *
 * Each product's GST rate comes from its VENDOR CATEGORY's `gst_rate` (percent).
 * A product is linked to a vendor category directly (products.vendor_category_id)
 * or via its product category (categories.vendor_category_id). The rate defaults
 * to 0, so GST is dormant — nothing is shown or charged — until an admin sets a
 * rate on the vendor category. GST is treated as exclusive (added on top of the
 * item price) and surfaced as a separate line, like a Swiggy/Zomato tax breakup.
 */
class GstService
{
    /**
     * Map product_id => gst_rate(%) for the given product rows (as loaded from
     * ProductModel). Products with no resolvable vendor category get 0.
     *
     * @param array<int,array<string,mixed>> $products
     * @return array<int,float>
     */
    public static function ratesForProducts(array $products): array
    {
        if (! $products) return [];

        // Product categories we need to resolve a vendor category for (only when
        // the product itself has no direct vendor_category_id).
        $catIds = [];
        foreach ($products as $p) {
            if ((int) ($p['vendor_category_id'] ?? 0) <= 0 && (int) ($p['category_id'] ?? 0) > 0) {
                $catIds[] = (int) $p['category_id'];
            }
        }
        $catVc = [];
        if ($catIds) {
            foreach ((new CategoryModel())->whereIn('id', array_values(array_unique($catIds)))->findAll() as $c) {
                $catVc[(int) $c['id']] = (int) ($c['vendor_category_id'] ?? 0);
            }
        }

        // Each product's effective vendor category id.
        $vcByProduct = [];
        foreach ($products as $p) {
            $vc = (int) ($p['vendor_category_id'] ?? 0);
            if ($vc <= 0) $vc = $catVc[(int) ($p['category_id'] ?? 0)] ?? 0;
            $vcByProduct[(int) $p['id']] = $vc;
        }

        $vcIds = array_values(array_unique(array_filter($vcByProduct)));
        $rateByVc = [];
        if ($vcIds) {
            foreach ((new VendorCategoryModel())->whereIn('id', $vcIds)->findAll() as $vc) {
                $rateByVc[(int) $vc['id']] = (float) ($vc['gst_rate'] ?? 0);
            }
        }

        $out = [];
        foreach ($vcByProduct as $pid => $vc) {
            $out[$pid] = $vc ? ($rateByVc[$vc] ?? 0.0) : 0.0;
        }
        return $out;
    }

    /** GST amount for a line, rounded to 2 dp. */
    public static function lineGst(float $amount, float $rate): float
    {
        return round($amount * $rate / 100, 2);
    }
}
