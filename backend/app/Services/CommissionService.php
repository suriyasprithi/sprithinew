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
 *   Buyback        15/10/5/2.5%  → ONE slot per order to the "currently eligible
 *                                  user" (system_settings 'buyback.eligible_user_id').
 *                                  Their personal counter `users.buyback_next_slot`
 *                                  advances 1→2→3→4 and the user exits eligibility
 *                                  when slot 4 has fired. The very next purchase by
 *                                  any non-eligible customer makes that buyer the
 *                                  new eligible user, picking up their pending slot
 *                                  (or starting at 1 if they have none).
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

        // Per-eligible-user buyback cycle. The "currently eligible user" is
        // tracked in system_settings; their personal buyback_next_slot tells
        // us which slot fires next. When their slot 4 fires, eligibility
        // clears and the very next purchase by a non-eligible customer
        // becomes the new eligible user (resuming their own pending slot or
        // starting at 1 if they have none).
        $db            = \Config\Database::connect();
        $settingsModel = new \App\Models\SystemSettingsModel();
        $eligibleId    = (int) ($settingsModel->get('buyback.eligible_user_id', '') ?: 0);
        $eligibleSince = (string) ($settingsModel->get('buyback.eligible_since', '') ?: '');

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
        $buybackRecipient = null;
        if ($eligibleId && $eligibleId !== (int) $purchaserUserId) {
            $u = $users->find($eligibleId);
            if ($u && ($u['status'] ?? 'active') === 'active' && (int) ($u['buyback_next_slot'] ?? 0) > 0) {
                // Each cycle of 4 slots must be filled by 4 DISTINCT customers.
                // If this purchaser has already fired a slot for the eligible
                // user during the current cycle, skip — the cycle waits for a
                // new face.
                $alreadyFired = 0;
                if ($eligibleSince !== '') {
                    $alreadyFired = (int) ($db->query(
                        'SELECT COUNT(*) c FROM purchase_commissions
                         WHERE beneficiary_id = ? AND source_user_id = ?
                           AND level < 0 AND created_at >= ?',
                        [(int) $u['id'], (int) $purchaserUserId, $eligibleSince]
                    )->getRow()->c ?? 0);
                }
                if ($alreadyFired === 0) {
                    $buybackRecipient = $u;
                }
            }
        }

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

        // Buyback — single slot per purchase to the currently eligible user.
        // Unused 3 slots' percentage falls to admin pool this order.
        $allBuybackPct = $buybackPct[1] + $buybackPct[2] + $buybackPct[3] + $buybackPct[4];

        if ($buybackRecipient) {
            $currentSlot = (int) $buybackRecipient['buyback_next_slot'];
            $slotPct     = $buybackPct[$currentSlot] ?? self::SLOT_PCT["buyback_{$currentSlot}"];
            $amt         = round($pool * $slotPct / 100, 2);
            $wallet->credit(
                (int) $buybackRecipient['id'], 'buyback', $amt, 'commission',
                'order#' . $orderId, "Buyback slot {$currentSlot}"
            );
            $log->insert([
                'order_id'       => $orderId,
                'beneficiary_id' => (int) $buybackRecipient['id'],
                'source_user_id' => $purchaserUserId,
                'level'          => -$currentSlot,
                'percent'        => $slotPct,
                'amount'         => $amt,
            ]);
            try {
                $notif->sendToUser((int) $buybackRecipient['id'], 'Buyback bonus',
                    "₹{$amt} (slot {$currentSlot}) from order #{$orderId}");
            } catch (\Throwable $e) { /* non-fatal */ }
            $applied[] = [
                'slot'           => "buyback_{$currentSlot}",
                'beneficiary_id' => (int) $buybackRecipient['id'],
                'amount'         => $amt,
            ];

            $adminPool += round($pool * ($allBuybackPct - $slotPct) / 100, 2);

            // Advance the eligible user's personal counter. Slot 4 → cycle
            // ends; clear eligibility so the next purchaser can take over.
            $nextSlot = $currentSlot + 1;
            if ($nextSlot > 4) {
                $users->update((int) $buybackRecipient['id'], ['buyback_next_slot' => 0]);
                $settingsModel->put('buyback.eligible_user_id', '');
                $settingsModel->put('buyback.eligible_since',    '');
            } else {
                $users->update((int) $buybackRecipient['id'], ['buyback_next_slot' => $nextSlot]);
            }
        } else {
            // No active eligible user (or eligible user is the buyer, or this
            // buyer has already counted this cycle). The buyer takes the
            // eligible spot if none is set — preserving any pending slot they
            // already have, or starting at slot 1 if they were inactive.
            $adminPool += round($pool * $allBuybackPct / 100, 2);

            if (! $eligibleId) {
                $buyerRow = $users->find($purchaserUserId);
                if ($buyerRow && ($buyerRow['status'] ?? 'active') === 'active') {
                    if ((int) ($buyerRow['buyback_next_slot'] ?? 0) === 0) {
                        $users->update($purchaserUserId, ['buyback_next_slot' => 1]);
                    }
                    $settingsModel->put('buyback.eligible_user_id', (string) $purchaserUserId);
                    $settingsModel->put('buyback.eligible_since',    date('Y-m-d H:i:s'));
                }
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
