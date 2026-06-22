<?php

namespace App\Services;

use App\Models\NotificationModel;
use App\Models\SystemSettingsModel;
use App\Models\UserModel;

/**
 * Awards the referral signup bonus up the new customer's 3-level upline chain.
 *
 * Rules (3-level cascade, decided 2026-06-12 — extends the original single-level
 * welcome bonus):
 *   - Fires once on a referred customer signup, in addition to the per-order %
 *     level commission (they are separate).
 *   - Pays each upline by DEPTH into their gated level_N wallet:
 *       1st upline (direct referrer) → level_1_wallet  (welcome.bonus_amount, ₹15)
 *       2nd upline                   → level_2_wallet  (welcome.bonus_l2, ₹10)
 *       3rd upline                   → level_3_wallet  (welcome.bonus_l3, ₹5)
 *   - Does NOT debit admin_wallet (system credit). Admin sees the aggregate via
 *     `SELECT COUNT(*), SUM(amount) FROM wallet_transactions WHERE type='welcome_bonus'`.
 *   - Logs a wallet_transactions row of type 'welcome_bonus' per level for that audit query.
 *   - Records + pushes an in-app notification on each credited upline.
 *   - Best-effort: any failure is logged and swallowed so signup never fails because of this.
 */
class WelcomeBonusService
{
    public function award(int $referrerId, int $newCustomerId): void
    {
        try {
            $settings = new SystemSettingsModel();
            if ($settings->get('welcome.bonus_active', '1') !== '1') {
                return;
            }

            // Bonus per upline depth (configurable via system_settings).
            $amounts = [
                1 => (float) $settings->get('welcome.bonus_amount', '15'),
                2 => (float) $settings->get('welcome.bonus_l2', '10'),
                3 => (float) $settings->get('welcome.bonus_l3', '5'),
            ];

            $users   = new UserModel();
            $notifs  = new NotificationModel();
            $wallet  = new WalletService();
            $current = $users->find($referrerId);

            for ($level = 1; $level <= 3; $level++) {
                if (! $current) {
                    break;
                }
                $amount = $amounts[$level] ?? 0.0;
                if ($amount > 0) {
                    // Referral bonus → the upline's dedicated, gated welcome_N
                    // wallet by depth (separate from the freely-transferable
                    // purchase-commission level_N wallet). Transfer to main is
                    // gated by depth-N referral count (100 / 10k / 10 lakh).
                    // Tagged 'welcome_bonus' for the audit aggregate query.
                    $wallet->credit(
                        (int) $current['id'],
                        "welcome_{$level}",
                        $amount,
                        'welcome_bonus',
                        'signup#' . $newCustomerId,
                        "Referral bonus L{$level}"
                    );

                    $notifs->recordFor(
                        (int) $current['id'],
                        'Referral bonus credited',
                        '₹' . number_format($amount, 2) . " added to your L{$level} wallet",
                        ['type' => 'welcome_bonus', 'entity_id' => $newCustomerId, 'route' => '/wallet']
                    );

                    // Push (best-effort — same try/catch wrapping pattern as other triggers)
                    try {
                        (new NotificationService())->sendToUser(
                            (int) $current['id'],
                            'Referral bonus credited',
                            '₹' . number_format($amount, 2) . " added to your L{$level} wallet",
                            ['type' => 'welcome_bonus', 'entity_id' => (string) $newCustomerId, 'route' => '/wallet']
                        );
                    } catch (\Throwable $e) {
                        log_message('error', 'Referral bonus push failed: ' . $e->getMessage());
                    }
                }

                // Walk one step up the referral chain.
                if (empty($current['referrer_id'])) {
                    break;
                }
                $current = $users->find((int) $current['referrer_id']);
            }
        } catch (\Throwable $e) {
            log_message('error', 'Welcome bonus award failed: ' . $e->getMessage());
        }
    }
}
