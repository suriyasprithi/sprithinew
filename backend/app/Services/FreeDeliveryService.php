<?php

namespace App\Services;

use App\Models\CartItemModel;
use App\Models\CategoryModel;
use App\Models\ProductModel;
use App\Models\ProductVariantModel;
use App\Models\SystemSettingsModel;

/**
 * Decides whether delivery is free for a customer's cart, applying four
 * admin-controlled rules in a fixed priority order with "first decisive
 * rule wins":
 *
 *   1. Category   — any cart category whose subtotal ≥ its free_delivery_min → FREE.
 *   2. Amount     — cart subtotal ≥ delivery.free.amount_min → FREE.
 *   3. Time       — now ∈ [time_from, time_to) → FREE, else PAID (decisive, stops).
 *   4. ETA        — chosen delivery minutes > eta_hours×60 AND subtotal ≥ min → FREE.
 *
 * Category / Amount / ETA grant free or fall through; the Time rule is the only
 * one that force-pays (its whole purpose is to define paid hours). All rules are
 * off by default, so behaviour is unchanged until an admin enables one.
 */
class FreeDeliveryService
{
    /**
     * @return array{free: bool, reason: ?string, subtotal: float}
     */
    public function evaluateForCart(int $userId, ?int $deliveryMinutes, ?\DateTime $now = null): array
    {
        $now = $now ?? new \DateTime('now');
        $s   = new SystemSettingsModel();

        // ---- Load cart → subtotal + per-category subtotals -----------------
        // Mirrors OrderController::place() pricing: variant price when a
        // variation is chosen, else the product price.
        $cart       = (new CartItemModel())->where('user_id', $userId)->findAll();
        $subtotal   = 0.0;
        $byCategory = []; // category_id => subtotal

        if ($cart) {
            $pids = array_values(array_unique(array_map(static fn ($r) => (int) $r['product_id'], $cart)));
            $vids = array_values(array_filter(array_map(static fn ($r) => (int) ($r['variation_id'] ?? 0), $cart)));
            $products = $pids ? (new ProductModel())->whereIn('id', $pids)->findAll() : [];
            $variants = $vids ? (new ProductVariantModel())->whereIn('id', $vids)->findAll() : [];
            $pById = []; foreach ($products as $p) $pById[(int) $p['id']] = $p;
            $vById = []; foreach ($variants as $v) $vById[(int) $v['id']] = $v;

            foreach ($cart as $r) {
                $p = $pById[(int) $r['product_id']] ?? null;
                if (! $p) continue;
                $price = (float) $p['price'];
                $vid   = (int) ($r['variation_id'] ?? 0);
                if ($vid && isset($vById[$vid])) $price = (float) $vById[$vid]['price'];
                $line  = $price * (int) $r['qty'];
                $subtotal += $line;
                $cid = (int) ($p['category_id'] ?? 0);
                if ($cid > 0) $byCategory[$cid] = ($byCategory[$cid] ?? 0.0) + $line;
            }
        }

        // ---- Rule 1: Category (per-category limit) -------------------------
        if ($s->get('delivery.free.category_enabled', '0') === '1' && $byCategory) {
            $cats = (new CategoryModel())->whereIn('id', array_keys($byCategory))->findAll();
            foreach ($cats as $c) {
                $limit = $c['free_delivery_min'] ?? null;
                if ($limit !== null && (float) $limit > 0
                    && ($byCategory[(int) $c['id']] ?? 0.0) >= (float) $limit) {
                    return ['free' => true, 'reason' => 'category', 'subtotal' => $subtotal];
                }
            }
            // none met → fall through to the next rule
        }

        // ---- Rule 2: Minimum purchase amount ------------------------------
        if ($s->get('delivery.free.amount_enabled', '0') === '1') {
            $min = (float) $s->get('delivery.free.amount_min', '500');
            if ($subtotal >= $min) {
                return ['free' => true, 'reason' => 'amount', 'subtotal' => $subtotal];
            }
            // below threshold → fall through
        }

        // ---- Rule 3: Time window (decisive) -------------------------------
        if ($s->get('delivery.free.time_enabled', '0') === '1') {
            $free = $this->inWindow(
                $now,
                (string) $s->get('delivery.free.time_from', '09:00'),
                (string) $s->get('delivery.free.time_to', '18:00')
            );
            return ['free' => $free, 'reason' => $free ? 'time' : 'time_paid', 'subtotal' => $subtotal];
        }

        // ---- Rule 4: Delivery-time (ETA) ----------------------------------
        if ($s->get('delivery.free.eta_enabled', '0') === '1') {
            $hours  = (float) $s->get('delivery.free.eta_hours', '4');
            $minAmt = (float) $s->get('delivery.free.eta_min_amount', '500');
            if ($deliveryMinutes !== null && $deliveryMinutes > $hours * 60 && $subtotal >= $minAmt) {
                return ['free' => true, 'reason' => 'eta', 'subtotal' => $subtotal];
            }
        }

        return ['free' => false, 'reason' => null, 'subtotal' => $subtotal];
    }

    /** Minutes since midnight for an "HH:MM" string (defensive against bad input). */
    private function minutes(string $hhmm): int
    {
        $parts = explode(':', trim($hhmm));
        $h = isset($parts[0]) ? (int) $parts[0] : 0;
        $m = isset($parts[1]) ? (int) $parts[1] : 0;
        return max(0, min(23, $h)) * 60 + max(0, min(59, $m));
    }

    /** True if $now's time-of-day is in [from, to). Handles overnight windows. */
    private function inWindow(\DateTime $now, string $from, string $to): bool
    {
        $t = (int) $now->format('G') * 60 + (int) $now->format('i');
        $f = $this->minutes($from);
        $e = $this->minutes($to);
        if ($f === $e) return false;            // degenerate/empty window
        if ($f < $e)   return $t >= $f && $t < $e;  // same-day window
        return $t >= $f || $t < $e;             // overnight window (e.g. 18:00→09:00)
    }
}
