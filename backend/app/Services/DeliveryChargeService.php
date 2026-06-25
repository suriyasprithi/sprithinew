<?php

namespace App\Services;

use App\Models\CartItemModel;
use App\Models\CategoryModel;
use App\Models\ProductModel;
use App\Models\ProductVariantModel;
use App\Models\VendorCategoryModel;

/**
 * Delivery charge — summed model.
 *
 * An order scheduled MORE than `delivery.free_above_hours` ahead is FREE (top
 * gate). Otherwise (urgent / within the window) the fee is the SUM of:
 *
 *   A. per-shop vendor-category charge — for each vendor category whose subtotal
 *      is below its `free_delivery_min` threshold, add that category's
 *      `delivery_charge`. Charged PER SHOP.
 *   B. evening surcharge (`delivery.charge`) — added ONCE when the delivery time
 *      falls in the paid window (`delivery.paid_start`→`delivery.paid_end`).
 *   C. the chosen delivery-time slot price — added ONCE.
 *
 * All amounts come from admin settings / vendor-category config.
 */
class DeliveryChargeService
{
    /**
     * Whole-cart quote for checkout: per-shop A summed + once B + once C.
     * @return array{free:bool, amount:float, reason:string, breakdown:array}
     */
    public function quoteCart(int $customerId, ?string $deliveryAt = null, float $slotPrice = 0.0): array
    {
        $cart = (new CartItemModel())->where('user_id', $customerId)->findAll() ?: [];
        if (! $cart) return $this->result(true, 0.0, 'empty', 0.0, 0.0, 0.0);

        // Scheduled far enough ahead → wholly free (top gate).
        if ($this->isFreeByEta($deliveryAt)) {
            return $this->result(true, 0.0, 'eta', 0.0, 0.0, 0.0);
        }

        // A — per-shop vendor-category charge, summed across shops.
        $catTotal = 0.0;
        foreach ($this->groupByVendor($cart) as $rows) {
            $catTotal += $this->categoryCharge($rows);
        }
        // B — evening surcharge once. C — slot price once.
        $evening = $this->eveningCharge($deliveryAt);
        $slot    = max(0.0, round($slotPrice, 2));

        $amount = round($catTotal + $evening + $slot, 2);
        return $this->result($amount <= 0, $amount, 'sum', $catTotal, $evening, $slot);
    }

    /**
     * Order-level-only quote (no cart): the free-by-eta gate + evening (B) +
     * slot (C). Used by prescription-only orders, which have no items yet, so
     * the per-shop vendor-category charge (A) is added later when the shop bills.
     * @return array{free:bool, amount:float, reason:string, breakdown:array}
     */
    public function quoteOrderLevel(?string $deliveryAt = null, float $slotPrice = 0.0): array
    {
        if ($this->isFreeByEta($deliveryAt)) {
            return $this->result(true, 0.0, 'eta', 0.0, 0.0, 0.0);
        }
        $evening = $this->eveningCharge($deliveryAt);
        $slot    = max(0.0, round($slotPrice, 2));
        $amount  = round($evening + $slot, 2);
        return $this->result($amount <= 0, $amount, 'sum', 0.0, $evening, $slot);
    }

    /** True when the order is scheduled beyond the free-above-hours window. */
    public function isFreeByEta(?string $deliveryAt): bool
    {
        if ($deliveryAt === null || $deliveryAt === '') return false;
        $freeHours = (new SystemSettingsService())->getFloat('delivery.free_above_hours', 4);
        $tz = new \DateTimeZone('Asia/Kolkata');
        try {
            $sel = new \DateTime($deliveryAt, $tz);
        } catch (\Throwable $e) {
            return false;
        }
        $now          = new \DateTime('now', $tz);
        $minutesAhead = ($sel->getTimestamp() - $now->getTimestamp()) / 60;
        return $minutesAhead > $freeHours * 60;
    }

    /** Evening surcharge (₹) when the delivery time-of-day is in the paid window, else 0. */
    public function eveningCharge(?string $deliveryAt): float
    {
        $settings  = new SystemSettingsService();
        $charge    = round($settings->getFloat('delivery.charge', 40), 2);
        $paidStart = self::toMinutes($settings->get('delivery.paid_start', '18:00'), 1080);
        $paidEnd   = self::toMinutes($settings->get('delivery.paid_end', '09:00'), 540);

        $tz  = new \DateTimeZone('Asia/Kolkata');
        $ref = null;
        if ($deliveryAt !== null && $deliveryAt !== '') {
            try { $ref = new \DateTime($deliveryAt, $tz); } catch (\Throwable $e) { $ref = null; }
        }
        $ref = $ref ?? new \DateTime('now', $tz);
        $minOfDay = (int) $ref->format('H') * 60 + (int) $ref->format('i');
        return $this->inPaidWindow($minOfDay, $paidStart, $paidEnd) ? $charge : 0.0;
    }

    /** Sum of below-threshold vendor-category charges for one set of cart rows (one shop). */
    public function categoryCharge(array $cart): float
    {
        $total = 0.0;
        foreach ($this->categorySubtotals($cart) as $info) {
            if ($info['subtotal'] < $info['threshold']) $total += $info['charge'];
        }
        return round($total, 2);
    }

    /** Group cart rows by their product's vendor (shop). */
    private function groupByVendor(array $cart): array
    {
        $ids      = array_values(array_unique(array_map(static fn ($r) => (int) $r['product_id'], $cart)));
        $products = $ids ? (new ProductModel())->whereIn('id', $ids)->findAll() : [];
        $vendorOf = []; foreach ($products as $p) $vendorOf[(int) $p['id']] = (int) ($p['vendor_id'] ?? 0);
        $byVendor = [];
        foreach ($cart as $r) { $byVendor[$vendorOf[(int) $r['product_id']] ?? 0][] = $r; }
        return $byVendor;
    }

    /**
     * Per vendor-category subtotal + that category's free-delivery threshold and
     * below-threshold charge. A product's vendor category is products.vendor_category_id
     * when set, else resolved from its product category (categories.vendor_category_id).
     */
    private function categorySubtotals(array $cart): array
    {
        if (! $cart) return [];

        $ids  = array_map(static fn ($r) => (int) $r['product_id'], $cart);
        $vids = array_values(array_filter(array_map(static fn ($r) => (int) ($r['variation_id'] ?? 0), $cart)));
        $products = $ids ? (new ProductModel())->whereIn('id', $ids)->findAll() : [];
        $variants = $vids ? (new ProductVariantModel())->whereIn('id', $vids)->findAll() : [];
        $byId  = []; foreach ($products as $p) $byId[(int) $p['id']]  = $p;
        $vById = []; foreach ($variants as $v) $vById[(int) $v['id']] = $v;

        $catIds  = array_values(array_filter(array_map(static fn ($p) => (int) ($p['category_id'] ?? 0), $products)));
        $vcByCat = [];
        if ($catIds) {
            foreach ((new CategoryModel())->whereIn('id', $catIds)->findAll() as $c) {
                $vcByCat[(int) $c['id']] = (int) ($c['vendor_category_id'] ?? 0);
            }
        }

        $subByVc = [];
        foreach ($cart as $r) {
            $p = $byId[(int) $r['product_id']] ?? null;
            if (! $p) continue;
            $vid   = (int) ($r['variation_id'] ?? 0);
            $price = ($vid && isset($vById[$vid])) ? (float) $vById[$vid]['price'] : (float) $p['price'];
            $vcId  = (int) ($p['vendor_category_id'] ?? 0) ?: ($vcByCat[(int) ($p['category_id'] ?? 0)] ?? 0);
            $subByVc[$vcId] = ($subByVc[$vcId] ?? 0) + $price * (int) $r['qty'];
        }

        $vcIds   = array_values(array_filter(array_keys($subByVc)));
        $cfgById = [];
        if ($vcIds) {
            foreach ((new VendorCategoryModel())->whereIn('id', $vcIds)->findAll() as $vc) {
                $cfgById[(int) $vc['id']] = [
                    'threshold' => (float) ($vc['free_delivery_min'] ?? 0),
                    'charge'    => (float) ($vc['delivery_charge'] ?? 0),
                ];
            }
        }

        $out = [];
        foreach ($subByVc as $vcId => $sub) {
            $out[$vcId] = [
                'subtotal'  => (float) $sub,
                'threshold' => $cfgById[$vcId]['threshold'] ?? 0.0,
                'charge'    => $cfgById[$vcId]['charge'] ?? 0.0,
            ];
        }
        return $out;
    }

    /** True if minute-of-day $m falls in the paid window (handles midnight wrap). */
    private function inPaidWindow(int $m, int $startMin, int $endMin): bool
    {
        if ($startMin === $endMin) return false;
        return $startMin <= $endMin
            ? ($m >= $startMin && $m < $endMin)
            : ($m >= $startMin || $m < $endMin);
    }

    /** Parse "HH:MM" to minutes-since-midnight, falling back to $default. */
    private static function toMinutes(?string $hhmm, int $default): int
    {
        if (! $hhmm || ! preg_match('/^(\d{1,2}):(\d{2})/', trim($hhmm), $mm)) return $default;
        $h = (int) $mm[1]; $i = (int) $mm[2];
        if ($h > 23 || $i > 59) return $default;
        return $h * 60 + $i;
    }

    private function result(bool $free, float $amount, string $reason, float $category, float $evening, float $slot): array
    {
        return [
            'free'      => $free,
            'amount'    => round($amount, 2),
            'reason'    => $reason,
            'breakdown' => [
                'category' => round($category, 2),
                'evening'  => round($evening, 2),
                'slot'     => round($slot, 2),
            ],
        ];
    }
}
