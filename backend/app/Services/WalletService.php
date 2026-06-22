<?php

namespace App\Services;

use App\Models\UserModel;
use App\Models\WalletTransactionModel;

/**
 * Multi-wallet support per user.
 * - wallet_balance (main, spendable)
 * - monthly_wallet
 * - level_wallet     (aggregate commission wallet; legacy)
 * - level_1_wallet   (L1 purchase commission — freely transferable)
 * - level_2_wallet   (L2 purchase commission — freely transferable)
 * - level_3_wallet   (L3 purchase commission — freely transferable)
 * - welcome_1_wallet (L1 signup referral bonus — gated: depth-1 ≥ 100)
 * - welcome_2_wallet (L2 signup referral bonus — gated: depth-2 ≥ 10,000)
 * - welcome_3_wallet (L3 signup referral bonus — gated: depth-3 ≥ 10,00,000)
 * - global_wallet
 * - buyback_wallet
 * - qr_wallet        (vendor in-store QR sales land here; vendor transfers to main wallet)
 */
class WalletService
{
    public const WALLETS = ['wallet', 'monthly', 'level', 'level_1', 'level_2', 'level_3', 'welcome_1', 'welcome_2', 'welcome_3', 'global', 'buyback', 'qr'];

    public static function column(string $key): string
    {
        return $key === 'wallet' ? 'wallet_balance' : $key . '_wallet';
    }

    public function balances(int $userId): array
    {
        $u = (new UserModel())->find($userId);
        if (! $u) return [];
        return [
            'wallet'  => (float) ($u['wallet_balance']   ?? 0),
            'monthly' => (float) ($u['monthly_wallet']   ?? 0),
            'level'   => (float) ($u['level_wallet']     ?? 0),
            'level_1' => (float) ($u['level_1_wallet']   ?? 0),
            'level_2' => (float) ($u['level_2_wallet']   ?? 0),
            'level_3' => (float) ($u['level_3_wallet']   ?? 0),
            'welcome_1' => (float) ($u['welcome_1_wallet'] ?? 0),
            'welcome_2' => (float) ($u['welcome_2_wallet'] ?? 0),
            'welcome_3' => (float) ($u['welcome_3_wallet'] ?? 0),
            'global'  => (float) ($u['global_wallet']    ?? 0),
            'buyback' => (float) ($u['buyback_wallet']   ?? 0),
            'qr'      => (float) ($u['qr_wallet']        ?? 0),
        ];
    }

    public function credit(int $userId, string $wallet, float $amount, string $type = 'credit', ?string $reference = null, ?string $notes = null): bool
    {
        if (! in_array($wallet, self::WALLETS, true)) return false;
        if ($amount <= 0) return false;
        $col = self::column($wallet);

        $users = new UserModel();
        $u = $users->find($userId);
        if (! $u) return false;
        $users->update($userId, [$col => (float) ($u[$col] ?? 0) + $amount]);

        (new WalletTransactionModel())->insert([
            'user_id'   => $userId,
            'amount'    => $amount,
            'type'      => $type,
            'reference' => $reference,
            'notes'     => ($notes ? $notes . ' ' : '') . "[+{$wallet}]",
        ]);
        return true;
    }

    public function debit(int $userId, string $wallet, float $amount, string $type = 'debit', ?string $reference = null, ?string $notes = null): bool
    {
        if (! in_array($wallet, self::WALLETS, true)) return false;
        if ($amount <= 0) return false;
        $col = self::column($wallet);

        $users = new UserModel();
        $u = $users->find($userId);
        if (! $u) return false;
        $current = (float) ($u[$col] ?? 0);
        if ($current < $amount) return false;
        $users->update($userId, [$col => $current - $amount]);

        (new WalletTransactionModel())->insert([
            'user_id'   => $userId,
            'amount'    => $amount,
            'type'      => $type,
            'reference' => $reference,
            'notes'     => ($notes ? $notes . ' ' : '') . "[-{$wallet}]",
        ]);
        return true;
    }

    /** Move money from one wallet to another (same user). */
    public function transfer(int $userId, string $from, string $to, float $amount): bool
    {
        if ($from === $to) return false;
        if (! $this->debit($userId, $from, $amount, 'debit', "transfer:{$from}->{$to}", 'transfer out')) return false;
        $this->credit($userId, $to, $amount, 'credit', "transfer:{$from}->{$to}", 'transfer in');
        return true;
    }
}
