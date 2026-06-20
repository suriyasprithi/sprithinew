<?php

namespace App\Services;

use App\Models\CartItemModel;
use App\Models\CategoryModel;
use App\Models\ProductModel;
use App\Models\ProductVariantModel;

/**
 * Rule-based delivery charge.
 *
 * The customer picks a delivery date+time at checkout. Priority order:
 *   1. The CHOSEN delivery time-of-day falls in the Paid Window (default
 *      18:00–09:00, wraps midnight) → PAID (flat charge). Highest priority:
 *      overrides both the long-lead-time rule and per-category free delivery.
 *   2. Else the chosen time is more than "free above" hours (default 4h) ahead
 *      of now → FREE.
 *   3. Else: every product category in the cart must have its subtotal
 *      ≥ that category's "Free delivery above ₹" threshold → FREE, else PAID.
 *
 * Threshold convention: 0 = "free above ₹0" = always qualifies.
 * If no delivery time is supplied, the paid window is checked against "now" and
 * the long-lead-time rule never applies (degrades gracefully).
 *
 * All amounts/rules come from system settings so the admin can tune them.
 */
class DeliveryChargeService
{
    /**
     * @param string|null $deliveryAt Customer-chosen delivery datetime (any
     *                                format DateTime understands), interpreted IST.
     * @return array{free: bool, amount: float, reason: string, charge: float}
     */
    public function quote(int $customerId, ?string $deliveryAt = null): array
    {
        $settings  = new SystemSettingsService();
        $charge    = round($settings->getFloat('delivery.charge', 40), 2);
        $freeHours = $settings->getFloat('delivery.free_above_hours', 4);
        $paidStart = self::toMinutes($settings->get('delivery.paid_start', '18:00'), 1080);
        $paidEnd   = self::toMinutes($settings->get('delivery.paid_end', '09:00'), 540);

        $tz  = new \DateTimeZone('Asia/Kolkata');
        $now = new \DateTime('now', $tz);
        $selected = null;
        if ($deliveryAt !== null && $deliveryAt !== '') {
            try { $selected = new \DateTime($deliveryAt, $tz); } catch (\Throwable $e) { $selected = null; }
        }
        $ref = $selected ?? $now;   // paid-window reference (chosen time, else now)

        // 1. Paid window — by the CHOSEN delivery time-of-day. Highest priority.
        $minOfDay = (int) $ref->format('H') * 60 + (int) $ref->format('i');
        if ($this->inPaidWindow($minOfDay, $paidStart, $paidEnd)) {
            return $this->result(false, $charge, 'night', $charge);
        }

        // 2. Scheduled far enough ahead of now → free.
        $minutesAhead = $selected ? (int) round(($selected->getTimestamp() - $now->getTimestamp()) / 60) : 0;
        if ($minutesAhead > (int) round($freeHours * 60)) {
            return $this->result(true, 0.0, 'eta', $charge);
        }

        // 3. Per-category thresholds — every category must qualify.
        foreach ($this->categorySubtotals($customerId) as $catId => $info) {
            if ($info['subtotal'] < $info['threshold']) {
                return $this->result(false, $charge, 'threshold', $charge);
            }
        }
        return $this->result(true, 0.0, 'threshold_met', $charge);
    }

    /** Sum the customer's cart by product category, attaching each category's threshold. */
    private function categorySubtotals(int $customerId): array
    {
        $cart = (new CartItemModel())->where('user_id', $customerId)->findAll();
        if (! $cart) return [];

        $ids  = array_map(static fn ($r) => (int) $r['product_id'], $cart);
        $vids = array_values(array_filter(array_map(static fn ($r) => (int) ($r['variation_id'] ?? 0), $cart)));
        $products = $ids ? (new ProductModel())->whereIn('id', $ids)->findAll() : [];
        $variants = $vids ? (new ProductVariantModel())->whereIn('id', $vids)->findAll() : [];
        $byId  = []; foreach ($products as $p) $byId[(int) $p['id']]  = $p;
        $vById = []; foreach ($variants as $v) $vById[(int) $v['id']] = $v;

        $subByCat = [];
        foreach ($cart as $r) {
            $p = $byId[(int) $r['product_id']] ?? null;
            if (! $p) continue;
            $vid   = (int) ($r['variation_id'] ?? 0);
            $price = ($vid && isset($vById[$vid])) ? (float) $vById[$vid]['price'] : (float) $p['price'];
            $catId = (int) ($p['category_id'] ?? 0);
            $subByCat[$catId] = ($subByCat[$catId] ?? 0) + $price * (int) $r['qty'];
        }

        // Resolve thresholds for the categories present (uncategorised id 0 → 0).
        $catIds = array_values(array_filter(array_keys($subByCat)));
        $thresholdById = [];
        if ($catIds) {
            foreach ((new CategoryModel())->whereIn('id', $catIds)->findAll() as $c) {
                $thresholdById[(int) $c['id']] = (float) ($c['free_delivery_min'] ?? 0);
            }
        }

        $out = [];
        foreach ($subByCat as $catId => $sub) {
            $out[$catId] = ['subtotal' => (float) $sub, 'threshold' => $thresholdById[$catId] ?? 0.0];
        }
        return $out;
    }

    /** True if minute-of-day $m falls in the paid window (handles midnight wrap). */
    private function inPaidWindow(int $m, int $startMin, int $endMin): bool
    {
        if ($startMin === $endMin) return false;             // empty window
        return $startMin <= $endMin
            ? ($m >= $startMin && $m < $endMin)              // same-day window
            : ($m >= $startMin || $m < $endMin);             // wraps past midnight
    }

    /** Parse "HH:MM" to minutes-since-midnight, falling back to $default. */
    private static function toMinutes(?string $hhmm, int $default): int
    {
        if (! $hhmm || ! preg_match('/^(\d{1,2}):(\d{2})/', trim($hhmm), $mm)) return $default;
        $h = (int) $mm[1]; $i = (int) $mm[2];
        if ($h > 23 || $i > 59) return $default;
        return $h * 60 + $i;
    }

    private function result(bool $free, float $amount, string $reason, float $charge): array
    {
        return ['free' => $free, 'amount' => round($amount, 2), 'reason' => $reason, 'charge' => round($charge, 2)];
    }
}
