<?php

namespace App\Services;

use App\Models\DistributeTokenModel;
use App\Models\UserModel;
use Config\Database;

/**
 * Token = main wallet (1 token = ₹1). vendor/taluk/state/district hold their
 * tokens in `wallet_balance` — there is NO separate token inventory.
 *
 *   admin (infinite source) ──► state ──► district ──► taluk ──► vendor
 *
 * Giving tokens downstream — manual distribute OR a fulfilled request — credits
 * the recipient's wallet with base + a commission bonus, where
 *   bonus = base × the RECIPIENT's rate (state 3.5% / district 3% / taluk 2% /
 *   vendor 0%, all configurable via system_settings token.bonus.<role>).
 * The giver pays that full amount out of its own wallet (admin is exempt — the
 * infinite source). Each level keeps the margin between the rate it earns and
 * the rate it pays down (state 0.5% / district 1% / taluk 2%); that running
 * margin is tracked in `bonus_balance` for the profit card. Balances never go
 * negative — a giver who can't cover the amount must request more from upstream.
 *
 * On customer purchase a vendor's wallet is debited items_subtotal × commission_pct
 * (clamped to what's available — an order is never blocked).
 */
class TokenService
{
    /** Direct downstream role allowed per current role. */
    private const HIERARCHY = [
        'admin'    => 'state',
        'state'    => 'district',
        'district' => 'taluk',
        'taluk'    => 'vendor',
    ];

    /**
     * Commission rate a recipient of the given role earns — the % added on top
     * of the base when tokens are credited to them. Configurable via
     * system_settings token.bonus.<role>; vendor (and anything else) gets 0%.
     */
    private function commissionRate(string $recipientRole): float
    {
        $svc = new SystemSettingsService();
        return match ($recipientRole) {
            'state'    => (float) $svc->get('token.bonus.state', '3.5') / 100,
            'district' => (float) $svc->get('token.bonus.district', '3.0') / 100,
            'taluk'    => (float) $svc->get('token.bonus.taluk', '2.0') / 100,
            default    => 0.0,
        };
    }

    /**
     * Core hop: give `$baseTokens` from $giver to $recipient. The recipient is
     * credited base + bonus (bonus = base × recipient's rate) into its wallet;
     * the giver pays that full credited amount out of its wallet (admin exempt —
     * infinite). bonus_balance moves with the bonus so each side's running margin
     * stays correct for the profit card. Throws if a non-admin giver's wallet
     * can't cover it (→ "request more from upstream"). Never goes negative.
     *
     * @return array{ledger_id:int, base:float, bonus:float, bonus_pct:float, credited:float}
     */
    private function creditWithCommission(array $giver, array $recipient, float $baseTokens, ?string $notes): array
    {
        if ($baseTokens <= 0) throw new \DomainException('Tokens must be positive');

        $rate     = $this->commissionRate($recipient['role'] ?? '');
        $bonus    = round($baseTokens * $rate, 2);
        $credited = round($baseTokens + $bonus, 2);
        $giverIsAdmin = ($giver['role'] ?? '') === 'admin';

        $giverWallet = (float) ($giver['wallet_balance'] ?? 0);
        if (! $giverIsAdmin && $giverWallet < $credited) {
            throw new \DomainException(
                ($giver['name'] ?? 'You') . ' has only ₹' . number_format($giverWallet, 2)
                . '; needs ₹' . number_format($credited, 2)
                . ($bonus > 0 ? " (incl. {$bonus} bonus)" : '')
                . '. Request more tokens from upstream.'
            );
        }

        $db = Database::connect();
        $db->transBegin();

        // Giver pays the full credited amount atomically; its bonus pot drops by
        // the bonus passed down (admin is the infinite source — not debited). The
        // `wallet_balance >= ?` guard makes the funds-check and debit one
        // indivisible statement, so concurrent distributes / a double-click can't
        // both pass a stale check and overdraw.
        if (! $giverIsAdmin) {
            $db->query(
                "UPDATE users SET wallet_balance = wallet_balance - ?, bonus_balance = GREATEST(0, bonus_balance - ?) WHERE id = ? AND wallet_balance >= ?",
                [$credited, $bonus, (int) $giver['id'], $credited]
            );
            if ($db->affectedRows() < 1) {
                $db->transRollback();
                throw new \DomainException(($giver['name'] ?? 'You') . ' has insufficient balance. Request more tokens from upstream.');
            }
        }
        // Recipient receives base + bonus atomically.
        $db->query(
            "UPDATE users SET wallet_balance = wallet_balance + ?, bonus_balance = bonus_balance + ? WHERE id = ?",
            [$credited, $bonus, (int) $recipient['id']]
        );

        $pct  = round($rate * 100, 4);
        $note = ($notes ?? '') . ($bonus > 0 ? " (+{$bonus} bonus @ {$pct}%)" : '');
        $id = (new DistributeTokenModel())->insert([
            'from_user_id' => (int) $giver['id'],
            'to_user_id'   => (int) $recipient['id'],
            'amount'       => 0,
            'tokens'       => $credited,
            'bonus'        => $bonus,
            'notes'        => $note,
        ], true);

        if ($db->transStatus() === false) { $db->transRollback(); throw new \RuntimeException('Token transfer failed'); }
        $db->transCommit();

        return ['ledger_id' => (int) $id, 'base' => $baseTokens, 'bonus' => $bonus, 'bonus_pct' => $pct, 'credited' => $credited];
    }

    /**
     * Manual distribute: a level gives tokens to its DIRECT downstream (selected
     * by mobile). Recipient gets base + commission; giver pays from its wallet.
     * Returns the inserted distribute_tokens row id.
     */
    public function distribute(array $sender, array $recipient, int $tokens, ?string $notes = null): int
    {
        if ($tokens <= 0) throw new \DomainException('Tokens must be positive');
        $expectedRole = self::HIERARCHY[$sender['role']] ?? null;
        if ($expectedRole === null) {
            throw new \DomainException("Role '{$sender['role']}' cannot distribute tokens");
        }
        if ($recipient['role'] !== $expectedRole) {
            throw new \DomainException("A {$sender['role']} can only distribute to a {$expectedRole} (got {$recipient['role']})");
        }
        if (($recipient['status'] ?? 'active') !== 'active') {
            throw new \DomainException('Recipient is not active');
        }
        return $this->creditWithCommission($sender, $recipient, (float) $tokens, $notes)['ledger_id'];
    }

    /**
     * Request fulfilment: approver credits the requester with base + commission.
     * Same model as distribute (no hierarchy check — the request decides routing).
     *
     * @return array{ledger_id:int, base:float, bonus:float, bonus_pct:float, credited:float}
     */
    public function fulfillRequest(array $approver, array $requester, float $tokens, string $notes): array
    {
        if (! in_array($approver['role'], ['taluk', 'district', 'state', 'admin'], true)) {
            throw new \DomainException("Role '{$approver['role']}' cannot fulfil a request");
        }
        return $this->creditWithCommission($approver, $requester, $tokens, $notes);
    }

    /**
     * Admin (or any level) manually credits a user — same commission model.
     * Returns the inserted distribute_tokens row id.
     */
    public function gift(array $sender, array $recipient, int $tokens, ?string $notes = null): int
    {
        return $this->creditWithCommission($sender, $recipient, (float) $tokens, $notes)['ledger_id'];
    }

    /**
     * Deduct an order's commission tokens from the vendor's wallet (1 token = ₹1).
     *
     *   tokens consumed = items_subtotal × vendor.commission_pct / 100
     *
     * Clamped to what's available — an order is NEVER blocked and the balance
     * never goes below 0.
     *
     * @return int Tokens consumed (≥ 0).
     */
    public function consumeForOrder(int $vendorId, float $itemsSubtotal): int
    {
        if ($itemsSubtotal <= 0) return 0;

        $users  = new UserModel();
        $vendor = $users->find($vendorId);
        if (! $vendor) throw new \DomainException('Vendor not found');

        $profile = (new \App\Models\VendorProfileModel())->where('user_id', $vendorId)->first();
        $commissionPct = $profile && isset($profile['commission_pct'])
            ? (float) $profile['commission_pct']
            : 10.0;

        $tokensNeeded = round($itemsSubtotal * $commissionPct / 100, 2);
        if ($tokensNeeded <= 0) return 0;

        $wb = (float) ($vendor['wallet_balance'] ?? 0);
        $consumed = min($wb, $tokensNeeded);
        if ($consumed > 0) {
            $users->update($vendorId, ['wallet_balance' => round($wb - $consumed, 2)]);
        }
        return (int) round($consumed);
    }

    /**
     * Find a vendor's upstream chain via geo joins:
     * vendor_profile.taluk_id → taluks.user_id → districts.user_id → states.user_id.
     * Returns ['taluk' => ?array, 'district' => ?array, 'state' => ?array] of
     * user rows (or null where the mapping isn't seeded).
     */
    public function findVendorChain(int $vendorId): array
    {
        $db = Database::connect();
        $row = $db->query(
            'SELECT vp.taluk_id, t.user_id AS taluk_user_id, t.district_id, d.user_id AS district_user_id, d.state_id, s.user_id AS state_user_id
             FROM vendor_profiles vp
             LEFT JOIN taluks t    ON t.id = vp.taluk_id
             LEFT JOIN districts d ON d.id = t.district_id
             LEFT JOIN states s    ON s.id = d.state_id
             WHERE vp.user_id = ?',
            [$vendorId]
        )->getRow();

        $users = new UserModel();
        $get = static fn ($id) => $id ? $users->find((int) $id) : null;
        return [
            'taluk'    => $row ? $get($row->taluk_user_id)    : null,
            'district' => $row ? $get($row->district_user_id) : null,
            'state'    => $row ? $get($row->state_user_id)    : null,
        ];
    }

    /** For UI: what the recipient gets + what the giver pays for `$tokens`. */
    public function quote(string $senderRole, int $tokens): array
    {
        $recipientRole = self::HIERARCHY[$senderRole] ?? null;
        $rate  = $recipientRole ? $this->commissionRate($recipientRole) : 0.0;
        $bonus = round($tokens * $rate, 2);
        return [
            'tokens'         => $tokens,
            'bonus'          => $bonus,
            'bonus_pct'      => round($rate * 100, 4),
            'recipient_gets' => round($tokens + $bonus, 2),
            'total_cost'     => round($tokens + $bonus, 2), // giver pays the same
            'recipient_role' => $recipientRole,
        ];
    }
}
