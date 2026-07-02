<?php

namespace App\Services;

use App\Models\ReferralModel;
use App\Models\SystemSettingsModel;
use App\Models\UserModel;

/**
 * Attaches a newly-created customer to its referrer's 3-level upline chain:
 *   - bumps each ancestor's level_N_count (atomic increment), and
 *   - inserts a referrals row per level, recording the per-level welcome-bonus
 *     amount that WelcomeBonusService::award() actually credits (L1/L2/L3).
 *
 * The referrals rows drive the activity feed and ReferralController's
 * total_bonus, so they must exist for a signup to appear there.
 *
 * Shared by AuthController::register (customer self-signup) and
 * AdminUsersController::create (admin-created customer) so both paths behave
 * identically. Kept in sync with WelcomeBonusService + legacy:backfill-referrals.
 * Best-effort per row: a failed insert is logged and skipped, never fatal.
 */
class ReferralChainService
{
    public function attach(int $referrerId, int $newCustomerId = 0): void
    {
        $users    = new UserModel();
        $current  = $users->find($referrerId);
        $refModel = new ReferralModel();

        $settings = new SystemSettingsModel();
        $active   = $settings->get('welcome.bonus_active', '1') === '1';
        $amount   = [
            1 => $active ? (float) $settings->get('welcome.bonus_amount', '15') : 0.0,
            2 => $active ? (float) $settings->get('welcome.bonus_l2', '10') : 0.0,
            3 => $active ? (float) $settings->get('welcome.bonus_l3', '5') : 0.0,
        ];

        for ($level = 1; $level <= 3; $level++) {
            if (! $current) break;
            $col = "level_{$level}_count";   // $level is 1..3 — safe to interpolate
            // Atomic increment so two customers attached under the same referrer
            // concurrently don't lose-update each other's count.
            \Config\Database::connect()->query("UPDATE users SET {$col} = {$col} + 1 WHERE id = ?", [(int) $current['id']]);
            if ($newCustomerId > 0) {
                try {
                    $refModel->insert([
                        'referrer_id'  => (int) $current['id'],
                        'referred_id'  => $newCustomerId,
                        'level'        => $level,
                        'bonus_amount' => $amount[$level] ?? 0,
                    ]);
                } catch (\Throwable $e) {
                    log_message('error', 'Referral insert failed: ' . $e->getMessage());
                }
            }
            if (empty($current['referrer_id'])) break;
            $current = $users->find((int) $current['referrer_id']);
        }
    }
}
