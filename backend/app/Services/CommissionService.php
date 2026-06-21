<?php

namespace App\Services;

use App\Models\MonthlyGlobalPoolModel;
use App\Models\MonthlyLuckyDrawPoolModel;
use App\Models\PurchaseCommissionModel;
use App\Models\SystemPoolModel;
use App\Models\UserModel;

/**
 * Order commission distribution.
 *
 * Per spec: every order pays a flat 10% pool. That pool is then split
 * 100% across 9 slots — vendor's 90% is paid separately by the caller.
 *
 *   Global Pool     :  2.5%   → system_pools.global
 *   Buyback        15/10/5/2.5%  → OVERLAPPING per-user cycles (buyback_cycles).
 *                                  Every purchase opens a cycle for the buyer
 *                                  (unless one is already open). Each open cycle
 *                                  collects from the next 4 DISTINCT buyers at the
 *                                  4 slot rates, then completes. One purchase
 *                                  advances every other open cycle it hasn't filled
 *                                  (oldest first) up to this order's buyback slice;
 *                                  buyback never draws from admin — overflow cycles
 *                                  wait, and any unused slice rolls into admin.
 *   L1 Referral     : 25.0%   → buyer's direct referrer level_1_wallet
 *   L2 Referral     : 10.0%   → grandparent level_2_wallet
 *   L3 Referral     :  1.5%   → great-grandparent level_3_wallet
 *   Lucky Draw      :  3.0%   → monthly_lucky_draw_pools (current month)
 *   Token Share     :  3.5%   → system_pools.token_share (funds token-request bonuses)
 *   Admin Share     : 22.0%   → system_pools.admin_wallet
 *
 * Slots with no eligible recipient (e.g. buyer has no upline, queue is short)
 * fall back to system_pools.admin_wallet — matches the "admin remainder" rule.
 */
class CommissionService
{
    /** Default pool % when the order has no vendor (or vendor profile is missing). */
    public const POOL_PCT_DEFAULT = 10.0;

    /** Fractions of the pool, NOT the order total. Must sum to 100. */
    public const SLOT_PCT = [
        'global'      =>  2.5,
        'lucky_draw'  =>  3.0,
        'buyback_1'   => 15.0,
        'buyback_2'   => 10.0,
        'buyback_3'   =>  5.0,
        'buyback_4'   =>  2.5,
        'level_1'     => 25.0,
        'level_2'     => 10.0,
        'level_3'     =>  1.5,
        'token_share' =>  3.5,
        'admin'       => 22.0,
    ];

    /**
     * Commission pool % for a vendor — their profile's commission_pct when set,
     * else the platform default. This is the single source of truth: the
     * vendor's wallet credit is (100 − this) and the distributed pool is (this),
     * so the credit and the cascade always reconcile to the order total.
     */
    public static function poolPctForVendor(?int $vendorId): float
    {
        if ($vendorId) {
            $profile = (new \App\Models\VendorProfileModel())->where('user_id', $vendorId)->first();
            if ($profile && isset($profile['commission_pct'])) {
                return (float) $profile['commission_pct'];
            }
        }
        return self::POOL_PCT_DEFAULT;
    }

    public function distributeForOrder(int $orderId, int $purchaserUserId, float $orderTotal, ?int $vendorId = null): array
    {
        // Idempotency: an order's commission/buyback is distributed exactly once.
        // The wallet-at-placement, paid, and COD-on-delivery triggers all flow
        // through here; the stamp makes any extra call a no-op. QR purchases have
        // no `orders` row (find() = null) and just proceed (one-shot anyway).
        $ordersModel = new \App\Models\OrderModel();
        $orderRow    = $ordersModel->find($orderId);
        if ($orderRow) {
            if (! empty($orderRow['commission_distributed_at'])) return [];
            $ordersModel->update($orderId, ['commission_distributed_at' => date('Y-m-d H:i:s')]);
        }

        $wallet = new WalletService();
        $users  = new UserModel();
        $log    = new PurchaseCommissionModel();
        $pools  = new SystemPoolModel();
        $notif  = new NotificationService();

        // Pool % comes from the vendor's profile when present, falling back to
        // the platform default so legacy orders without a vendor still work.
        $poolPct = self::poolPctForVendor($vendorId);
        $pool = round($orderTotal * ($poolPct / 100), 2);
        if ($pool <= 0) return [];

        // Resolve referrer chain (L1, L2, L3)
        $buyer    = $users->find($purchaserUserId);
        $l1 = $l2 = $l3 = null;
        if ($buyer && ! empty($buyer['referrer_id'])) {
            $l1 = $users->find((int) $buyer['referrer_id']);
            if ($l1 && ! empty($l1['referrer_id']))     $l2 = $users->find((int) $l1['referrer_id']);
            if ($l2 && ! empty($l2['referrer_id']))     $l3 = $users->find((int) $l2['referrer_id']);
        }

        // Overlapping buyback cycles — see the buyback section below. We need a
        // DB handle and the settings model (for admin-tunable slot %s).
        $db            = \Config\Database::connect();
        $settingsModel = new \App\Models\SystemSettingsModel();

        // L1/L2/L3 referral commission percentages — admin-tunable via
        // system_settings (mlm.level_N_pct), defaulting to the SLOT_PCT
        // constants. The admin slot absorbs any delta so the 10% pool still
        // sums to 100% (see $adminPctEffective below).
        $levelPct = [
            1 => max(0.0, (float) $settingsModel->get('mlm.level_1_pct', (string) self::SLOT_PCT['level_1'])),
            2 => max(0.0, (float) $settingsModel->get('mlm.level_2_pct', (string) self::SLOT_PCT['level_2'])),
            3 => max(0.0, (float) $settingsModel->get('mlm.level_3_pct', (string) self::SLOT_PCT['level_3'])),
        ];

        // Buyback FIFO slot percentages — admin-tunable (buyback.slot_N_pct),
        // defaulting to the SLOT_PCT constants. The admin slot absorbs any
        // delta from the constant total so the pool still sums to 100%.
        $buybackPct = [
            1 => max(0.0, (float) $settingsModel->get('buyback.slot_1_pct', (string) self::SLOT_PCT['buyback_1'])),
            2 => max(0.0, (float) $settingsModel->get('buyback.slot_2_pct', (string) self::SLOT_PCT['buyback_2'])),
            3 => max(0.0, (float) $settingsModel->get('buyback.slot_3_pct', (string) self::SLOT_PCT['buyback_3'])),
            4 => max(0.0, (float) $settingsModel->get('buyback.slot_4_pct', (string) self::SLOT_PCT['buyback_4'])),
        ];
        $applied   = [];
        $adminPool = 0.0;

        $awardUser = function (?array $upline, string $walletKind, int $level, float $amt) use ($wallet, $log, $notif, $orderId, $purchaserUserId, $levelPct, &$applied, &$adminPool) {
            if (! $upline) { $adminPool += $amt; return; }
            $wallet->credit((int) $upline['id'], $walletKind, $amt, 'commission', 'order#' . $orderId, "L{$level} commission");
            $log->insert([
                'order_id'       => $orderId,
                'beneficiary_id' => (int) $upline['id'],
                'source_user_id' => $purchaserUserId,
                'level'          => $level,
                'percent'        => $levelPct[$level] ?? self::SLOT_PCT["level_{$level}"],
                'amount'         => $amt,
            ]);
            try { $notif->sendToUser((int) $upline['id'], 'Commission earned', "₹{$amt} (L{$level}) from order #{$orderId}"); } catch (\Throwable $e) { /* non-fatal */ }
            $applied[] = ['slot' => "level_{$level}", 'beneficiary_id' => (int) $upline['id'], 'amount' => $amt];
        };

        // L1 / L2 / L3 referral slots (percentages admin-tunable; see $levelPct)
        $awardUser($l1, 'level_1', 1, round($pool * $levelPct[1] / 100, 2));
        $awardUser($l2, 'level_2', 2, round($pool * $levelPct[2] / 100, 2));
        $awardUser($l3, 'level_3', 3, round($pool * $levelPct[3] / 100, 2));

        // ===== Buyback: overlapping per-user cycles =====
        // Every purchase opens a cycle for the buyer (unless they already have
        // one open). Each open cycle collects from the next 4 DISTINCT buyers at
        // slot rates 15/10/5/2.5% of each of those buyers' pools. A single
        // purchase advances every OTHER open cycle it hasn't already filled,
        // oldest first, until the order's buyback slice is spent. Buyback never
        // draws from admin; any unused slice rolls into the admin pool (as
        // before). Overflow cycles simply wait for the next purchase.
        $cycles        = new \App\Models\BuybackCycleModel();
        $allBuybackPct = $buybackPct[1] + $buybackPct[2] + $buybackPct[3] + $buybackPct[4];
        $buybackBudget = round($pool * $allBuybackPct / 100, 2);  // hard cap for this order
        $buybackSpent  = 0.0;

        // Open cycles owned by someone else, oldest first, that THIS buyer has
        // not already filled. The NOT EXISTS keeps the distinct-buyer rule
        // scoped per-cycle: a buyer who paid an earlier (closed) cycle is free
        // to pay the collector's current cycle, since cycle ids differ.
        $openCycles = $db->query(
            'SELECT c.* FROM buyback_cycles c
             WHERE c.status = ? AND c.user_id <> ?
               AND NOT EXISTS (
                 SELECT 1 FROM purchase_commissions pc
                 WHERE pc.buyback_cycle_id = c.id AND pc.source_user_id = ?
               )
             ORDER BY c.opened_at ASC, c.id ASC',
            ['open', (int) $purchaserUserId, (int) $purchaserUserId]
        )->getResultArray();

        foreach ($openCycles as $cyc) {
            $slot    = (int) $cyc['next_slot'];
            $slotPct = $buybackPct[$slot] ?? self::SLOT_PCT["buyback_{$slot}"];
            $amt     = round($pool * $slotPct / 100, 2);
            if ($amt <= 0) continue;
            // Cap: never spend more than this order's buyback slice. Overflow
            // cycles wait for the next purchase; admin is never touched.
            if (round($buybackSpent + $amt, 2) > $buybackBudget) break;

            $collectorId = (int) $cyc['user_id'];
            $wallet->credit($collectorId, 'buyback', $amt, 'commission', 'order#' . $orderId, "Buyback slot {$slot}");
            $log->insert([
                'order_id'         => $orderId,
                'beneficiary_id'   => $collectorId,
                'source_user_id'   => $purchaserUserId,
                'level'            => -$slot,
                'buyback_cycle_id' => (int) $cyc['id'],
                'percent'          => $slotPct,
                'amount'           => $amt,
            ]);
            try {
                $notif->sendToUser($collectorId, 'Buyback bonus', "₹{$amt} (slot {$slot}) from order #{$orderId}");
            } catch (\Throwable $e) { /* non-fatal */ }
            $applied[]    = ['slot' => "buyback_{$slot}", 'beneficiary_id' => $collectorId, 'amount' => $amt];
            $buybackSpent = round($buybackSpent + $amt, 2);

            // Advance the cycle. Filling slot 4 completes it.
            if ($slot >= 4) {
                $cycles->update((int) $cyc['id'], ['next_slot' => 4, 'status' => 'completed', 'completed_at' => date('Y-m-d H:i:s')]);
            } else {
                $cycles->update((int) $cyc['id'], ['next_slot' => $slot + 1]);
            }
        }

        // Whatever of the buyback slice wasn't paid out falls to the admin pool.
        $adminPool += round($buybackBudget - $buybackSpent, 2);

        // Open a fresh cycle for the buyer if they have none currently open.
        $buyerRow = $users->find($purchaserUserId);
        if ($buyerRow && ($buyerRow['status'] ?? 'active') === 'active') {
            $hasOpen = (int) ($db->query(
                'SELECT COUNT(*) c FROM buyback_cycles WHERE user_id = ? AND status = ?',
                [(int) $purchaserUserId, 'open']
            )->getRow()->c ?? 0);
            if ($hasOpen === 0) {
                $now = date('Y-m-d H:i:s');
                $cycles->insert(['user_id' => (int) $purchaserUserId, 'next_slot' => 1, 'status' => 'open', 'opened_at' => $now]);
            }
        }

        // Global pool slot — accrues into the CURRENT month's bucket so it can
        // be distributed at month-end by `php spark pool:distribute`.
        $globalAmt = round($pool * self::SLOT_PCT['global'] / 100, 2);
        (new MonthlyGlobalPoolModel())->add(date('Y-m'), $globalAmt);

        // Lucky draw slot — accrues into the CURRENT month's bucket. Admin
        // picks the winner manually via /admin/lucky-draw page. The % is
        // admin-tunable via system_settings; the admin slot absorbs the delta
        // so the pool still sums to 100% (clamped so admin can't go negative).
        $luckyPct = max(0.0, (float) $settingsModel->get('commission.lucky_draw_pct', (string) self::SLOT_PCT['lucky_draw']));
        $luckyAmt = round($pool * $luckyPct / 100, 2);
        (new MonthlyLuckyDrawPoolModel())->add(date('Y-m'), $luckyAmt);

        // Token-share slot — funds the token-request bonuses paid up the geo
        // chain (state/district/taluk). TokenService draws from this
        // system_pools.token_share balance when it fulfils requests. % is
        // admin-tunable; the admin slot absorbs the delta (see below).
        $tokenSharePct = max(0.0, (float) $settingsModel->get('commission.token_share_pct', (string) self::SLOT_PCT['token_share']));
        $tokenShareAmt = round($pool * $tokenSharePct / 100, 2);
        $pools->add('token_share', $tokenShareAmt);

        // Admin pool slot + everything that fell through. The admin slot absorbs
        // the lucky-draw and token-share deltas so the total still sums to 100%
        // (clamped so admin can't go negative on extreme misconfiguration).
        $adminPctEffective = self::SLOT_PCT['admin']
            + (self::SLOT_PCT['lucky_draw']  - $luckyPct)
            + (self::SLOT_PCT['token_share'] - $tokenSharePct)
            + (self::SLOT_PCT['level_1'] - $levelPct[1])
            + (self::SLOT_PCT['level_2'] - $levelPct[2])
            + (self::SLOT_PCT['level_3'] - $levelPct[3])
            + ((self::SLOT_PCT['buyback_1'] + self::SLOT_PCT['buyback_2'] + self::SLOT_PCT['buyback_3'] + self::SLOT_PCT['buyback_4']) - $allBuybackPct);
        $adminPctEffective = max(0.0, $adminPctEffective);
        $adminAmt = round($pool * $adminPctEffective / 100, 2) + $adminPool;
        $pools->add('admin_wallet', $adminAmt);

        $applied[] = ['slot' => 'global',      'pool' => 'monthly_global_pools:' . date('Y-m'),     'amount' => $globalAmt];
        $applied[] = ['slot' => 'lucky_draw',  'pool' => 'monthly_lucky_draw_pools:' . date('Y-m'), 'amount' => $luckyAmt];
        $applied[] = ['slot' => 'token_share', 'pool' => 'token_share',                             'amount' => $tokenShareAmt];
        $applied[] = ['slot' => 'admin',       'pool' => 'admin_wallet',                            'amount' => $adminAmt];

        return $applied;
    }
}
