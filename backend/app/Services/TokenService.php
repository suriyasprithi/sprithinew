<?php

namespace App\Services;

use App\Models\DistributeTokenModel;
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
        if ($sender['role'] !== 'admin' && (int) ($sender['token_balance'] ?? 0) < $tokens) {
            throw new \DomainException('Insufficient token_balance');
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

        // Tokens: -sender (admin exempt — infinite source), +recipient
        if ($sender['role'] !== 'admin') {
            $users->update((int) $sender['id'], [
                'token_balance' => (int) $sender['token_balance'] - $tokens,
            ]);
        }
        $users->update((int) $recipient['id'], [
            'token_balance' => (int) ($recipient['token_balance'] ?? 0) + $tokens,
        ]);

        // ₹: -recipient, +sender (admin's ₹ goes to admin_wallet pool instead of user.wallet_balance)
        if ($amount > 0) {
            $users->update((int) $recipient['id'], [
                'wallet_balance' => (float) $recipient['wallet_balance'] - $amount,
            ]);
            if ($sender['role'] === 'admin') {
                $db->table('system_pools')
                    ->where('pool_key', 'admin_wallet')
                    ->set('balance', "balance + {$amount}", false)
                    ->update();
            } else {
                $users->update((int) $sender['id'], [
                    'wallet_balance' => (float) $sender['wallet_balance'] + $amount,
                ]);
            }
        }

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

        // A customer's order must never be blocked by the vendor's token
        // balance, so we never throw on a shortage — deduct only what's
        // available (clamped at 0, never negative) and proceed.
        $have = (int) ($vendor['token_balance'] ?? 0);
        $consumed = min($have, $tokensNeeded);
        if ($consumed > 0) {
            $users->update($vendorId, ['token_balance' => $have - $consumed]);
        }
        return $consumed;
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
        if ($sender['role'] !== 'admin' && (int) ($sender['token_balance'] ?? 0) < $tokens) {
            throw new \DomainException("{$sender['name']} has only " . (int) ($sender['token_balance'] ?? 0) . " tokens; needs {$tokens}");
        }

        $db    = Database::connect();
        $users = new UserModel();
        $db->transStart();

        if ($sender['role'] !== 'admin') {
            $users->update((int) $sender['id'], [
                'token_balance' => (int) $sender['token_balance'] - $tokens,
            ]);
        }
        $users->update((int) $recipient['id'], [
            'token_balance' => (int) ($recipient['token_balance'] ?? 0) + $tokens,
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
     * Fulfil a token request: move tokens from the approving level down to
     * the vendor along the chain. If any intermediate link isn't mapped yet
     * (taluks.user_id / districts.user_id / states.user_id is NULL), fall
     * back to a direct gift from approver to vendor with a note.
     *
     * Returns the list of distribute_tokens ledger ids created.
     */
    /**
     * One-hop fulfilment: approver → requester only. No chain cascading.
     * Each level handles its own requests; if they're empty they must
     * create their own request to the level above.
     */
    public function fulfillRequest(array $approver, array $requester, int $tokens, string $notes): array
    {
        if (! in_array($approver['role'], ['taluk', 'district', 'state', 'admin'], true)) {
            throw new \DomainException("Role '{$approver['role']}' cannot fulfil a request");
        }
        return [$this->gift($approver, $requester, $tokens, $notes)];
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
