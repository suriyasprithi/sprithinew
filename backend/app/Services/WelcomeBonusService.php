<?php

namespace App\Services;

use App\Models\NotificationModel;
use App\Models\SystemSettingsModel;
use App\Models\UserModel;
use App\Models\WalletTransactionModel;

/**
 * Awards the referrer's welcome bonus on a referred customer signup.
 *
 * Rules (decided 2026-05-13, overrides BUILD_SPEC_V2.md §3):
 *   - Reads welcome.bonus_amount + welcome.bonus_active live from system_settings.
 *   - Credits referrer's level_wallet by the configured amount.
 *   - Does NOT debit admin_wallet (system credit). Admin sees aggregate via
 *     `SELECT COUNT(*), SUM(amount) FROM wallet_transactions WHERE type='welcome_bonus'`.
 *   - Logs a wallet_transactions row of type 'welcome_bonus' for that audit query.
 *   - Records an in-app notification on the referrer.
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
            $amount = (float) $settings->get('welcome.bonus_amount', '15');
            if ($amount <= 0) {
                return;
            }

            $users    = new UserModel();
            $referrer = $users->find($referrerId);
            if (! $referrer) {
                return;
            }

            $users->update($referrerId, [
                'level_wallet' => (float) ($referrer['level_wallet'] ?? 0) + $amount,
            ]);

            (new WalletTransactionModel())->insert([
                'user_id'      => $referrerId,
                'peer_user_id' => $newCustomerId,
                'amount'       => $amount,
                'type'         => 'welcome_bonus',
                'reference'    => 'signup#' . $newCustomerId,
                'notes'        => 'Welcome bonus for referring customer',
            ]);

            (new NotificationModel())->recordFor(
                $referrerId,
                'Welcome bonus credited',
                '₹' . number_format($amount, 2) . ' added to your level wallet',
                ['type' => 'welcome_bonus', 'entity_id' => $newCustomerId, 'route' => '/wallet']
            );

            // Push (best-effort — same try/catch wrapping pattern as other triggers)
            try {
                (new NotificationService())->sendToUser(
                    $referrerId,
                    'Welcome bonus credited',
                    '₹' . number_format($amount, 2) . ' added to your level wallet',
                    ['type' => 'welcome_bonus', 'entity_id' => (string) $newCustomerId, 'route' => '/wallet']
                );
            } catch (\Throwable $e) {
                log_message('error', 'Welcome bonus push failed: ' . $e->getMessage());
            }
        } catch (\Throwable $e) {
            log_message('error', 'Welcome bonus award failed: ' . $e->getMessage());
        }
    }
}
