<?php

namespace App\Services;

use App\Models\DistributeTokenModel;
use App\Models\SystemPoolModel;
use App\Models\UserModel;
use Config\Database;

/**
 * Inventory-currency token flow:
 *
 *   admin (infinite source) ──► state ──► district ──► taluk ──► vendor
 *                                +₹2       +₹1        +₹1        (consumed on purchase)
 *
 *   Each hop validates hierarchy, moves token_balance, and moves ₹ in the
 *   opposite direction (downstream pays upstream the base rate + markup, the
 *   markup stays with the seller as profit).
 *
 *   On customer purchase: each order item deducts `category.token_cost × qty`
 *   from the vendor's token_balance. Insufficient = order rejected.
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

    /** Markup in ₹/token added at each level above admin. */
    private function loadRates(): array
    {
        $svc = new SystemSettingsService();
        return [
            'base'     => (float) $svc->get('token.base_rate', '1.00'),
            'state'    => (float) $svc->get('token.markup.state', '2.00'),
            'district' => (float) $svc->get('token.markup.district', '1.00'),
            'taluk'    => (float) $svc->get('token.markup.taluk', '1.00'),
        ];
    }

    /**
     * Cost the recipient pays per token, given the sender's role.
     *   admin    → state   pays base                         = ₹1
     *   state    → district pays base + state                = ₹3
     *   district → taluk    pays base + state + district     = ₹4
     *   taluk    → vendor   pays base + state + district + taluk = ₹5
     */
    private function unitCostFor(string $senderRole, array $rates): float
    {
        return match ($senderRole) {
            'admin'    => $rates['base'],
            'state'    => $rates['base'] + $rates['state'],
            'district' => $rates['base'] + $rates['state'] + $rates['district'],
            'taluk'    => $rates['base'] + $rates['state'] + $rates['district'] + $rates['taluk'],
            default    => 0.0,
        };
    }

    /**
     * Move `$tokens` from $sender to $recipient. Throws DomainException on
     * any rule violation. Returns the inserted distribute_tokens row id.
     */
    public function distribute(array $sender, array $recipient, int $tokens, ?string $notes = null): int
    {
        if ($tokens <= 0) {
            throw new \DomainException('Tokens must be positive');
        }
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
        // Sender spends tokens first, then falls back to its main wallet
        // (1 token = ₹1) for any shortfall — so the combined balance must cover it.
        $senderSpendable = (float) ($sender['token_balance'] ?? 0) + (float) ($sender['wallet_balance'] ?? 0);
        if ($sender['role'] !== 'admin' && $senderSpendable < $tokens) {
            throw new \DomainException("{$sender['name']} has only " . $senderSpendable . " (tokens + wallet); needs {$tokens}");
        }

        $rates    = $this->loadRates();
        $unitCost = $this->unitCostFor($sender['role'], $rates);
        $amount   = round($unitCost * $tokens, 2);

        // Recipient must have ₹ to pay for the tokens (admin sells for free is
        // intentionally allowed when base=0; otherwise enforce).
        if ($amount > 0 && (float) ($recipient['wallet_balance'] ?? 0) < $amount) {
            throw new \DomainException("Recipient wallet has ₹" . number_format((float) ($recipient['wallet_balance'] ?? 0), 2) . "; needs ₹" . number_format($amount, 2));
        }

        $db    = Database::connect();
        $users = new UserModel();
        $db->transStart();

        // Sender pays the tokens from its token_balance first, then its wallet
        // (1 token = ₹1) for any shortfall. The recipient's ₹ payment (base +
        // markup) is folded into the SAME sender wallet update so it isn't lost.
        // Admin is the infinite source — its ₹ income goes to the admin_wallet pool.
        $senderTb = (float) ($sender['token_balance'] ?? 0);
        $senderWb = (float) ($sender['wallet_balance'] ?? 0);
        if ($sender['role'] !== 'admin') {
            $fromTokens = min($senderTb, (float) $tokens);
            $fromWallet = round($tokens - $fromTokens, 2);
            $users->update((int) $sender['id'], [
                'token_balance'  => round($senderTb - $fromTokens, 2),
                'wallet_balance' => round($senderWb - $fromWallet + ($amount > 0 ? $amount : 0.0), 2),
            ]);
        } elseif ($amount > 0) {
            $db->table('system_pools')
                ->where('pool_key', 'admin_wallet')
                ->set('balance', "balance + {$amount}", false)
                ->update();
        }

        // Recipient: +tokens, and pays ₹ (base + markup) out of its wallet.
        $users->update((int) $recipient['id'], [
            'token_balance'  => round((float) ($recipient['token_balance'] ?? 0) + $tokens, 2),
            'wallet_balance' => round((float) ($recipient['wallet_balance'] ?? 0) - $amount, 2),
        ]);

        $id = (new DistributeTokenModel())->insert([
            'from_user_id' => (int) $sender['id'],
            'to_user_id'   => (int) $recipient['id'],
            'amount'       => $amount,
            'tokens'       => $tokens,
            'notes'        => $notes,
        ], true);

        $db->transComplete();
        if ($db->transStatus() === false) {
            throw new \RuntimeException('Token distribution failed');
        }
        return (int) $id;
    }

    /**
     * Deduct inventory tokens for an order from the vendor's token_balance.
     *
     * Tokens consumed = items_subtotal × vendor.commission_pct / 100
     *
     * 1 token = ₹1, so the vendor pays as many tokens as the rupee value of
     * their commission pool. ₹150 order at 10% commission → 15 tokens.
     *
     * @param int   $vendorId
     * @param float $itemsSubtotal  Order subtotal *excluding* delivery fees.
     * @throws \DomainException if vendor lacks balance.
     * @return int                 Tokens consumed (≥ 0).
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

        $tokensNeeded = (int) round($itemsSubtotal * $commissionPct / 100);
        if ($tokensNeeded <= 0) return 0;

        // A customer's order must never be blocked by the vendor's balance, so we
        // never throw — the vendor pays from its token_balance first, then its main
        // wallet (1 token = ₹1) for any shortfall, clamped to what's available.
        $tb = (float) ($vendor['token_balance'] ?? 0);
        $wb = (float) ($vendor['wallet_balance'] ?? 0);
        $consumed = min($tb + $wb, (float) $tokensNeeded);
        if ($consumed > 0) {
            $fromTokens = min($tb, $consumed);
            $fromWallet = round($consumed - $fromTokens, 2);
            $users->update($vendorId, [
                'token_balance'  => round($tb - $fromTokens, 2),
                'wallet_balance' => round($wb - $fromWallet, 2),
            ]);
        }
        return (int) round($consumed);
    }

    /**
     * Debit `$amount` of token-value from $user inside the current transaction,
     * drawing token_balance first and falling back to wallet_balance (1 token =
     * ₹1) for any shortfall. Caller must ensure the combined balance covers
     * `$amount` (or pre-clamp it). Returns [fromTokens, fromWallet].
     */
    private function debitTokensThenWallet(UserModel $users, array $user, float $amount): array
    {
        $tb = (float) ($user['token_balance'] ?? 0);
        $wb = (float) ($user['wallet_balance'] ?? 0);
        $fromTokens = min($tb, $amount);
        $fromWallet = round($amount - $fromTokens, 2);
        $users->update((int) $user['id'], [
            'token_balance'  => round($tb - $fromTokens, 2),
            'wallet_balance' => round($wb - $fromWallet, 2),
        ]);
        return [$fromTokens, $fromWallet];
    }

    /**
     * Gift `$tokens` from sender to recipient with no ₹ payment. Used for
     * request-fulfillment hops where the approver bears the cost.
     * Skips hierarchy check (caller decides routing) — but still enforces
     * sender token balance unless sender is admin (infinite source).
     */
    public function gift(array $sender, array $recipient, int $tokens, ?string $notes = null): int
    {
        if ($tokens <= 0) throw new \DomainException('Tokens must be positive');
        $spendable = (float) ($sender['token_balance'] ?? 0) + (float) ($sender['wallet_balance'] ?? 0);
        if ($sender['role'] !== 'admin' && $spendable < $tokens) {
            throw new \DomainException("{$sender['name']} has only " . $spendable . " (tokens + wallet); needs {$tokens}");
        }

        $db    = Database::connect();
        $users = new UserModel();
        $db->transStart();

        if ($sender['role'] !== 'admin') {
            $this->debitTokensThenWallet($users, $sender, (float) $tokens);
        }
        $users->update((int) $recipient['id'], [
            'token_balance' => (float) ($recipient['token_balance'] ?? 0) + $tokens,
        ]);
        $id = (new DistributeTokenModel())->insert([
            'from_user_id' => (int) $sender['id'],
            'to_user_id'   => (int) $recipient['id'],
            'amount'       => 0,
            'tokens'       => $tokens,
            'notes'        => $notes,
        ], true);

        $db->transComplete();
        if ($db->transStatus() === false) throw new \RuntimeException('Gift failed');
        return (int) $id;
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

    /**
     * Base bonus RATE for the requester's role (state 3.5% / district 3% /
     * taluk 2% / vendor 0%) — the raw configured %, not compounded. Drives the
     * siphon-down-the-chain model: the requester draws this % of the upline's
     * bonus pot (or, at the admin hop, mints this % of the requested tokens).
     * Configurable via system_settings (token.bonus.<role>).
     */
    private function baseBonusRate(string $requesterRole): float
    {
        $svc = new SystemSettingsService();
        return match ($requesterRole) {
            'state'    => (float) $svc->get('token.bonus.state', '3.5') / 100,
            'district' => (float) $svc->get('token.bonus.district', '3.0') / 100,
            'taluk'    => (float) $svc->get('token.bonus.taluk', '2.0') / 100,
            default    => 0.0, // vendor (and anything else) gets no bonus
        };
    }

    /**
     * One-hop fulfilment of a token request: approver → requester only.
     * No chain cascading — each level handles its immediate-below requests.
     *
     * The requester is credited base + bonus. The bonus is sourced two ways:
     *   - admin approver (top hop): MINTED = requestedTokens × roleRate, drawn
     *     from the token_share pool (clamped). Seeds the requester's bonus pot.
     *     Admin is the infinite source and is never debited.
     *   - staff approver (state/district/taluk): SIPHONED = approver's own bonus
     *     pot × roleRate, transferred out of the approver. The approver pays
     *     base + bonus from its token_balance and its bonus pot drops by the
     *     bonus; the requester's pot rises by it (so its own downline can later
     *     siphon). No ₹ changes hands.
     *
     * @return array{ledger_id:int, base:float, bonus:float, bonus_pct:float, credited:float}
     */
    public function fulfillRequest(array $approver, array $requester, float $tokens, string $notes): array
    {
        if ($tokens <= 0) throw new \DomainException('Tokens must be positive');
        if (! in_array($approver['role'], ['taluk', 'district', 'state', 'admin'], true)) {
            throw new \DomainException("Role '{$approver['role']}' cannot fulfil a request");
        }

        // Base (non-compounded) bonus rate for the requester's role.
        $rate     = $this->baseBonusRate($requester['role'] ?? '');
        $bonusPct  = round($rate * 100, 4);

        $approverIsAdmin = $approver['role'] === 'admin';
        $approverTokens  = (float) ($approver['token_balance'] ?? 0);
        $approverWallet  = (float) ($approver['wallet_balance'] ?? 0);
        $approverPot     = (float) ($approver['bonus_balance'] ?? 0);

        // Non-admin approvers pay the base from their token_balance first, then
        // their main wallet (1 token = ₹1) — so the combined balance must cover it.
        if (! $approverIsAdmin && ($approverTokens + $approverWallet) < $tokens) {
            throw new \DomainException("{$approver['name']} has only " . ($approverTokens + $approverWallet) . " (tokens + wallet); needs {$tokens}");
        }

        $db    = Database::connect();
        $users = new UserModel();
        $pools = new SystemPoolModel();
        $db->transStart();

        if ($approverIsAdmin) {
            // Top hop: mint roleRate × requested tokens from the token_share pool.
            $desiredBonus = round($tokens * $rate, 2);
            $bonus        = $pools->take('token_share', $desiredBonus);
            $fundNote     = $bonus > 0 ? 'token_share-funded' : 'token_share pool empty';
        } else {
            // Staff hop: siphon roleRate × the approver's own bonus pot, clamped
            // so the approver can always cover base + bonus from its tokens.
            $desiredBonus = round($approverPot * $rate, 2);
            $bonus        = round(min($desiredBonus, $approverPot, max(0.0, $approverTokens - $tokens)), 2);
            // Base comes from token_balance first, then the wallet (1 token = ₹1)
            // for any shortfall. The bonus is only drawn from the token surplus, so
            // when the base needs the wallet the surplus — and thus bonus — is 0.
            $fromTokens = min($approverTokens, (float) $tokens);
            $fromWallet = round($tokens - $fromTokens, 2);
            $users->update((int) $approver['id'], [
                'token_balance'  => round($approverTokens - $fromTokens - $bonus, 2),
                'wallet_balance' => round($approverWallet - $fromWallet, 2),
                'bonus_balance'  => round($approverPot - $bonus, 2),
            ]);
            $fundNote = $bonus > 0 ? ('siphoned from ' . ($approver['name'] ?? 'upline')) : 'upline bonus pot empty';
        }

        $credited = round($tokens + $bonus, 2);
        $users->update((int) $requester['id'], [
            'token_balance' => round((float) ($requester['token_balance'] ?? 0) + $credited, 2),
            'bonus_balance' => round((float) ($requester['bonus_balance'] ?? 0) + $bonus, 2),
        ]);

        $ledgerNote = $bonus > 0
            ? "{$notes} (+{$bonus} bonus @ {$bonusPct}%, {$fundNote})"
            : ($desiredBonus > 0 ? "{$notes} (bonus 0 — {$fundNote})" : $notes);
        $id = (new DistributeTokenModel())->insert([
            'from_user_id' => (int) $approver['id'],
            'to_user_id'   => (int) $requester['id'],
            'amount'       => 0,
            'tokens'       => $credited,
            'bonus'        => $bonus,
            'notes'        => $ledgerNote,
        ], true);

        $db->transComplete();
        if ($db->transStatus() === false) throw new \RuntimeException('Fulfil failed');

        return [
            'ledger_id'     => (int) $id,
            'base'          => (float) $tokens,
            'bonus'         => $bonus,
            'desired_bonus' => $desiredBonus,
            'bonus_pct'     => $bonusPct,
            'credited'      => $credited,
        ];
    }

    /** For UI: how much would the next hop cost? */
    public function quote(string $senderRole, int $tokens): array
    {
        $rates = $this->loadRates();
        $unit  = $this->unitCostFor($senderRole, $rates);
        return [
            'unit_cost'     => $unit,
            'tokens'        => $tokens,
            'total_cost'    => round($unit * $tokens, 2),
            'recipient_role'=> self::HIERARCHY[$senderRole] ?? null,
            'rates'         => $rates,
        ];
    }
}
