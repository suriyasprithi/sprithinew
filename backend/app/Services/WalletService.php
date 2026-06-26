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

    /** A customer must always keep this much in their main wallet — only the
     *  amount ABOVE it is withdrawable or spendable via QR. */
    public const CUSTOMER_MIN_BALANCE = 500.0;

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
        $col = self::column($wallet);   // $col is from the WALLETS whitelist — safe to interpolate.

        // Atomic single-statement increment (no read-modify-write) so concurrent
        // credits can't lose-update each other. amount is bound; col is whitelisted.
        $db = \Config\Database::connect();
        $db->query("UPDATE users SET {$col} = {$col} + ? WHERE id = ?", [$amount, $userId]);
        if ($db->affectedRows() < 1) return false;   // no such user (amount>0 always changes the row)

        (new WalletTransactionModel())->insert([
            'user_id'   => $userId,
            'amount'    => $amount,
            'type'      => $type,
            'wallet'    => $wallet,
            'reference' => $reference,
            'notes'     => ($notes ? $notes . ' ' : '') . "[+{$wallet}]",
        ]);
        return true;
    }

    public function debit(int $userId, string $wallet, float $amount, string $type = 'debit', ?string $reference = null, ?string $notes = null): bool
    {
        if (! in_array($wallet, self::WALLETS, true)) return false;
        if ($amount <= 0) return false;
        $col = self::column($wallet);   // whitelisted column name — safe to interpolate.

        // Atomic conditional decrement: the `>= ?` guard makes the balance check
        // and the debit one indivisible statement, so concurrent debits can't both
        // pass a stale check and overdraw. 0 affected rows = insufficient balance.
        $db = \Config\Database::connect();
        $db->query("UPDATE users SET {$col} = {$col} - ? WHERE id = ? AND {$col} >= ?", [$amount, $userId, $amount]);
        if ($db->affectedRows() < 1) return false;   // insufficient balance or no such user

        (new WalletTransactionModel())->insert([
            'user_id'   => $userId,
            'amount'    => $amount,
            'type'      => $type,
            'wallet'    => $wallet,
            'reference' => $reference,
            'notes'     => ($notes ? $notes . ' ' : '') . "[-{$wallet}]",
        ]);
        return true;
    }

    /** Move money from one wallet to another (same user) — all-or-nothing. */
    public function transfer(int $userId, string $from, string $to, float $amount): bool
    {
        if ($from === $to) return false;

        $db = \Config\Database::connect();
        $db->transBegin();
        if (! $this->debit($userId, $from, $amount, 'debit', "transfer:{$from}->{$to}", 'transfer out')) {
            $db->transRollback();
            return false;
        }
        if (! $this->credit($userId, $to, $amount, 'credit', "transfer:{$from}->{$to}", 'transfer in')) {
            $db->transRollback();
            return false;
        }
        if ($db->transStatus() === false) {
            $db->transRollback();
            return false;
        }
        $db->transCommit();
        return true;
    }
}
