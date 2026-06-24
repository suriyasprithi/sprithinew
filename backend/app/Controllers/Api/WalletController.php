<?php

namespace App\Controllers\Api;

use App\Models\UserModel;
use App\Models\WalletTransactionModel;
use App\Services\NotificationService;
use App\Services\SystemSettingsService;
use App\Services\WalletService;
use CodeIgniter\HTTP\ResponseInterface;

class WalletController extends BaseApiController
{
    public function balance(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        $u = (new UserModel())->find($auth->id);
        return $this->ok(['balance' => (float) ($u['wallet_balance'] ?? 0)]);
    }

    public function wallets(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $balances = (new WalletService())->balances((int) $auth->id);

        // Welcome-wallet unlock status per depth, so the wallet UI can show a
        // lock badge + progress and enable/disable the transfer action. Read the
        // user row once; the depth counts are denormalized columns on it.
        $u = (new UserModel())->find((int) $auth->id);
        $welcomeStatus = [];
        foreach ([1, 2, 3] as $level) {
            $count     = (int) ($u["level_{$level}_count"] ?? 0);
            $threshold = $this->welcomeThreshold($level);
            $welcomeStatus[$level] = [
                'count'     => $count,
                'threshold' => $threshold,
                'unlocked'  => $count >= $threshold,
            ];
        }

        return $this->ok(array_merge($balances, ['welcome_status' => $welcomeStatus]));
    }

    /**
     * Per-wallet transaction history for the logged-in user.
     * Filters wallet_transactions by the wallet-tag suffix that
     * WalletService::credit/debit append to the notes column.
     */
    public function history(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $wallet = (string) $this->request->getGet('wallet');

        // Virtual aliases spanning the L1/L2/L3 wallets:
        //   referral = purchase commissions (level_N wallets, excludes signup bonuses)
        //   welcome  = signup referral bonuses (welcome_N wallets + pre-separation
        //              ones that still sit in level_N — both tagged welcome_bonus)
        $isReferral = $wallet === 'referral';
        $isWelcome  = $wallet === 'welcome';
        if ($isReferral) {
            $tagWallets = ['level_1', 'level_2', 'level_3'];
        } elseif ($isWelcome) {
            $tagWallets = ['welcome_1', 'welcome_2', 'welcome_3', 'level_1', 'level_2', 'level_3'];
        } else {
            $tagWallets = [$wallet];
        }
        if (! $isReferral && ! $isWelcome && ! in_array($wallet, \App\Services\WalletService::WALLETS, true)) {
            return $this->fail('Invalid wallet', 422);
        }

        // Build OR-list of LIKE patterns for the matching tag set. We match both
        // the modern [+wallet]/[-wallet] note tags AND the un-tagged legacy rows
        // imported from u290807677_epey, so migrated users see their full history.
        $isMain         = $wallet === 'wallet';
        $isCommissionLv = in_array($wallet, ['level_1', 'level_2', 'level_3'], true);
        $isWelcomeLv    = in_array($wallet, ['welcome_1', 'welcome_2', 'welcome_3'], true);
        $conds   = [];
        $params  = [(int) $auth->id];
        foreach ($tagWallets as $tw) {
            $conds[]  = 'notes LIKE ?';
            $params[] = '%[+' . $tw . ']%';
            $conds[]  = 'notes LIKE ?';
            $params[] = '%[-' . $tw . ']%';

            // Legacy commission rows are tagged in notes as "level N type M
            // [legacy income]" — surface them on the matching L1/L2/L3 card.
            if (preg_match('/^level_([123])$/', $tw, $lvl)) {
                $conds[]  = '(notes LIKE ? AND notes LIKE ?)';
                $params[] = 'level ' . $lvl[1] . ' type%';
                $params[] = '%[legacy income]%';
            }
        }
        // The main wallet also carries the legacy withdrawals and purchases.
        if ($isMain) {
            $conds[]  = 'notes LIKE ?';
            $params[] = '%[legacy withdraw]%';
            $conds[]  = 'notes LIKE ?';
            $params[] = '%[legacy purchase]%';
        }
        // Match the legacy note-tags (unchanged) OR the new first-class `wallet`
        // column (set by WalletService + the wallet:backfill command). The column
        // rescues rows whose notes never carried a tag — the "missing old records".
        $walletInPh = implode(',', array_fill(0, count($tagWallets), '?'));
        $where = 'user_id = ? AND ( (' . implode(' OR ', $conds) . ') OR wallet IN (' . $walletInPh . ') )';
        foreach ($tagWallets as $tw) { $params[] = $tw; }
        // Commission views (referral / direct level_N): the NEW per-order purchase
        // commission only — exclude both signup bonuses and old legacy income.
        // Referral-bonus views (welcome alias / direct welcome_N): signup welcome
        // bonus PLUS the OLD legacy referral income — but NOT the new per-order
        // purchase commission.
        if ($isReferral || $isCommissionLv) {
            $where .= " AND type != 'welcome_bonus' AND notes NOT LIKE '%[legacy income]%'";
        } elseif ($isWelcome || $isWelcomeLv) {
            $where .= " AND (type = 'welcome_bonus' OR notes LIKE '%[legacy income]%')";
        }

        // Fetch up to 2000 matching rows: totals are summed over all of them,
        // while only the latest 100 are returned for display.
        $db   = \Config\Database::connect();
        $rows = $db->query(
            'SELECT id, amount, type, wallet, reference, notes, created_at
             FROM wallet_transactions
             WHERE ' . $where . '
             ORDER BY id DESC
             LIMIT 2000',
            $params
        )->getResultArray();

        $map = static function ($r) use ($tagWallets) {
            $notes      = (string) $r['notes'];
            $isCredit   = false;
            $matchedTag = null;

            // Modern tagged transactions.
            foreach ($tagWallets as $tw) {
                if (strpos($notes, '[+' . $tw . ']') !== false) { $isCredit = true;  $matchedTag = $tw; break; }
                if (strpos($notes, '[-' . $tw . ']') !== false) { $isCredit = false; $matchedTag = $tw; break; }
            }
            // Un-tagged legacy rows: income = credit to its level, withdraw/
            // purchase = debit from the main wallet.
            if ($matchedTag === null) {
                if (strpos($notes, '[legacy income]') !== false) {
                    $isCredit   = true;
                    $matchedTag = preg_match('/^level\s+([123])\s+type/', $notes, $lm) ? 'level_' . $lm[1] : ($tagWallets[0] ?? null);
                } elseif (strpos($notes, '[legacy withdraw]') !== false || strpos($notes, '[legacy purchase]') !== false) {
                    $isCredit   = false;
                    $matchedTag = 'wallet';
                }
            }
            // Backfilled rows: no note-tag, but the wallet column says which wallet.
            // Direction comes from the transaction type (money out vs money in).
            if ($matchedTag === null && ! empty($r['wallet'])) {
                $matchedTag = (string) $r['wallet'];
                $isCredit   = ! in_array((string) $r['type'], ['payment', 'withdraw', 'debit'], true);
            }

            // Strip the internal [+wallet] / [-wallet] tag for display.
            $cleanNotes = $notes;
            foreach ($tagWallets as $tw) {
                $cleanNotes = preg_replace('/\s*\[[+\-]' . preg_quote($tw, '/') . '\]\s*/', '', $cleanNotes);
            }
            return [
                'id'         => (int) $r['id'],
                'amount'     => (float) $r['amount'],
                'direction'  => $isCredit ? 'credit' : 'debit',
                'type'       => (string) $r['type'],
                'reference'  => $r['reference'],
                'notes'      => trim($cleanNotes ?: ''),
                'source'     => $matchedTag,
                'created_at' => $r['created_at'],
            ];
        };

        $all = array_map($map, $rows);

        $totalCredit = 0.0;
        $totalDebit  = 0.0;
        foreach ($all as $r) {
            if ($r['direction'] === 'credit') $totalCredit += $r['amount'];
            else                              $totalDebit  += $r['amount'];
        }

        $items = array_slice($all, 0, 100);

        // Enrich rows so the user can see WHO each credit came from:
        //   - order#/qr# (buyback / purchase commission) → the buyer (shop, taluk,
        //     name, MASKED mobile e.g. 98******76).
        //   - signup#    (welcome referral bonus)        → the new customer who
        //     signed up under them (name, taluk via their pincode, MASKED mobile).
        $mask = static function (?string $mob): ?string {
            $d = preg_replace('/\D/', '', (string) $mob);
            if ($d === '') return null;
            return strlen($d) <= 4 ? $d : substr($d, 0, 2) . str_repeat('*', strlen($d) - 4) . substr($d, -2);
        };

        $orderIds  = [];
        $signupIds = [];
        foreach ($items as $r) {
            if (preg_match('/(?:order|qr)#(\d+)/', (string) $r['reference'], $m)) {
                $orderIds[(int) $m[1]] = true;
            } elseif (preg_match('/signup#(\d+)/', (string) $r['reference'], $m)) {
                $signupIds[(int) $m[1]] = true;
            }
        }

        $byId = [];
        if ($orderIds) {
            $ids  = array_keys($orderIds);
            $ph   = implode(',', array_fill(0, count($ids), '?'));
            $meta = $db->query(
                "SELECT o.id,
                        COALESCE(NULLIF(vp.shop_name, ''), vu.name) AS shop,
                        vt.name AS taluk,
                        cu.name AS customer_name,
                        cu.mobile_number AS customer_mobile
                 FROM orders o
                 LEFT JOIN users vu           ON vu.id = o.vendor_id
                 LEFT JOIN vendor_profiles vp ON vp.user_id = o.vendor_id
                 LEFT JOIN taluks vt          ON vt.id = vp.taluk_id
                 LEFT JOIN users cu           ON cu.id = o.customer_id
                 WHERE o.id IN ($ph)",
                $ids
            )->getResultArray();
            foreach ($meta as $mrow) {
                $byId['order#' . (int) $mrow['id']] = [
                    'shop'            => $mrow['shop'] ?: null,
                    'taluk'           => $mrow['taluk'] ?: null,
                    'customer_name'   => $mrow['customer_name'] ?: null,
                    'customer_mobile' => $mask($mrow['customer_mobile'] ?? null),
                ];
            }
        }

        // Signup rows: the referred customer's name + taluk (resolved from their
        // pincode) + masked mobile.
        if ($signupIds) {
            $ids  = array_keys($signupIds);
            $ph   = implode(',', array_fill(0, count($ids), '?'));
            $meta = $db->query(
                "SELECT su.id,
                        su.name AS customer_name,
                        su.mobile_number AS customer_mobile,
                        st.name AS taluk
                 FROM users su
                 LEFT JOIN pincodes pc ON pc.code = su.pincode
                 LEFT JOIN taluks st   ON st.id = pc.taluk_id
                 WHERE su.id IN ($ph)",
                $ids
            )->getResultArray();
            foreach ($meta as $mrow) {
                $byId['signup#' . (int) $mrow['id']] = [
                    'shop'            => null,
                    'taluk'           => $mrow['taluk'] ?: null,
                    'customer_name'   => $mrow['customer_name'] ?: null,
                    'customer_mobile' => $mask($mrow['customer_mobile'] ?? null),
                ];
            }
        }

        if ($byId) {
            foreach ($items as &$r) {
                $r['meta'] = preg_match('/((?:order|qr|signup)#\d+)/', (string) $r['reference'], $m)
                    ? ($byId[str_replace('qr#', 'order#', $m[1])] ?? $byId[$m[1]] ?? null)
                    : null;
            }
            unset($r);
        }

        // Current balance (for the header card).
        $bal = (new \App\Services\WalletService())->balances((int) $auth->id);
        if ($isWelcome) {
            // Welcome (gated) balance = the dedicated welcome_N wallets.
            $balance = round(($bal['welcome_1'] ?? 0) + ($bal['welcome_2'] ?? 0) + ($bal['welcome_3'] ?? 0), 2);
        } elseif ($isReferral) {
            // Commission balance = level_N total, minus any pre-separation signup
            // bonus that still sits in level_N (tagged [+level_N] welcome_bonus).
            $refBonus = (float) ($db->query(
                "SELECT COALESCE(SUM(amount),0) AS s FROM wallet_transactions
                 WHERE user_id = ? AND type = 'welcome_bonus'
                   AND (notes LIKE '%[+level_1]%' OR notes LIKE '%[+level_2]%' OR notes LIKE '%[+level_3]%')",
                [(int) $auth->id]
            )->getRow()->s ?? 0);
            $levelTotal = ($bal['level_1'] ?? 0) + ($bal['level_2'] ?? 0) + ($bal['level_3'] ?? 0);
            $balance = round($levelTotal - $refBonus, 2);
        } else {
            $balance = (float) ($bal[$wallet] ?? 0);
        }

        return $this->ok([
            'wallet'        => $wallet,
            'balance'       => $balance,
            'total_credit'  => $totalCredit,
            'total_debit'   => $totalDebit,
            'items'         => $items,
        ]);
    }

    /**
     * Admin-only: current global pool balance + recent monthly history.
     * Used by the admin wallet page to surface the platform's accumulating
     * 2.5% global pool and how it's been paid out month over month.
     */
    public function adminGlobalPool(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth || $auth->role !== 'admin') return $this->fail('Forbidden', 403);

        $db = \Config\Database::connect();

        $current = (float) ($db->query(
            "SELECT balance FROM system_pools WHERE pool_key = 'global'"
        )->getRow()->balance ?? 0);

        // Last 12 months: collected, distributed, eligible count, per-user share.
        $months = $db->query(
            'SELECT id, period, collected, distributed, eligible_count, per_user_amount,
                    distributed_at, created_at
             FROM monthly_global_pools
             ORDER BY period DESC LIMIT 12'
        )->getResultArray();

        $items = array_map(static fn ($r) => [
            'id'              => (int) $r['id'],
            'period'          => (string) $r['period'],
            'collected'       => (float) $r['collected'],
            'distributed'     => (float) $r['distributed'],
            'eligible_count'  => (int) $r['eligible_count'],
            'per_user_amount' => (float) $r['per_user_amount'],
            'distributed_at'  => $r['distributed_at'],
            'created_at'      => $r['created_at'],
        ], $months);

        $totalCollected   = 0.0;
        $totalDistributed = 0.0;
        foreach ($items as $r) {
            $totalCollected   += $r['collected'];
            $totalDistributed += $r['distributed'];
        }

        return $this->ok([
            'current_balance'   => $current,
            'total_collected'   => $totalCollected,
            'total_distributed' => $totalDistributed,
            'months'            => $items,
        ]);
    }

    /**
     * Global pool distribution history for the logged-in user.
     * Joins monthly_global_distributions to monthly_global_pools so the UI
     * can show period (YYYY-MM), credited amount, and pool-wide context
     * (per-user share, eligible count) for transparency.
     */
    public function globalHistory(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $db   = \Config\Database::connect();
        $rows = $db->query(
            'SELECT d.id, d.amount, d.created_at,
                    p.period, p.collected, p.distributed,
                    p.eligible_count, p.per_user_amount
             FROM monthly_global_distributions d
             JOIN monthly_global_pools p ON p.id = d.pool_id
             WHERE d.user_id = ?
             ORDER BY p.period DESC, d.id DESC',
            [(int) $auth->id]
        )->getResultArray();

        $items = array_map(static fn ($r) => [
            'id'              => (int) $r['id'],
            'period'          => (string) $r['period'],
            'amount'          => (float) $r['amount'],
            'pool_collected'  => (float) $r['collected'],
            'pool_distributed'=> (float) $r['distributed'],
            'eligible_count'  => (int)   $r['eligible_count'],
            'per_user_amount' => (float) $r['per_user_amount'],
            'created_at'      => $r['created_at'],
        ], $rows);

        $total = 0.0;
        foreach ($items as $r) $total += $r['amount'];

        return $this->ok([
            'items' => $items,
            'total' => $total,
        ]);
    }

    public function transfer(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $d   = $this->request->getJSON(true) ?? $this->request->getPost();
        $svc = new WalletService();

        // "level" = the combined level (L1+L2+L3). Purchase-level wallets transfer
        // freely to the main wallet (no referral gate). Drains L1, L2, L3 up to the
        // requested amount.
        if (($d['from'] ?? '') === 'level') {
            if (! is_numeric($d['amount'] ?? null) || (float) $d['amount'] <= 0) return $this->fail('Amount required', 422);
            $amount   = round((float) $d['amount'], 2);
            $bal      = $svc->balances((int) $auth->id);
            $unlocked = ['level_1', 'level_2', 'level_3'];
            $avail = 0.0;
            foreach ($unlocked as $lk) $avail = round($avail + $bal[$lk], 2);
            if ($amount > $avail + 0.005) return $this->fail('Insufficient unlocked level balance', 402);
            $left = $amount;
            foreach ($unlocked as $lk) {
                if ($left <= 0.005) break;
                $take = round(min($left, $bal[$lk]), 2);
                if ($take > 0) { $svc->transfer((int) $auth->id, $lk, 'wallet', $take); $left -= $take; }
            }
            return $this->ok($svc->balances((int) $auth->id), 'Transferred');
        }

        if (! $this->validate([
            'from'   => 'required|in_list[wallet,monthly,level_1,level_2,level_3,welcome_1,welcome_2,welcome_3,global,buyback,qr]',
            'to'     => 'required|in_list[wallet,monthly,level_1,level_2,level_3,welcome_1,welcome_2,welcome_3,global,buyback,qr]',
            'amount' => 'required|numeric|greater_than[0]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());
        if ($d['from'] === $d['to']) return $this->fail('Source and destination must differ', 422);

        // Welcome/referral-bonus wallets unlock only when the user's downline at
        // that depth reaches the configured threshold (depth-1 = 100, depth-2 = 10k,
        // depth-3 = 10 lakh). Gating the SOURCE blocks any outbound hop, so there's
        // no bypass. Purchase level_N wallets are NOT gated; they transfer freely.
        if (preg_match('/^welcome_([123])$/', $d['from'], $m)) {
            $level     = (int) $m[1];
            $have      = $this->referralDepthCount((int) $auth->id, $level);
            $threshold = $this->welcomeThreshold($level);
            if ($have < $threshold) {
                return $this->fail(
                    "L{$level} unlocks at " . number_format($threshold)
                    . " level-{$level} referrals — you have " . number_format($have) . '.',
                    403
                );
            }
        }

        $ok = $svc->transfer((int) $auth->id, $d['from'], $d['to'], (float) $d['amount']);
        if (! $ok) return $this->fail('Insufficient balance in source wallet', 402);
        return $this->ok($svc->balances((int) $auth->id), 'Transferred');
    }

    /**
     * Admin-tunable welcome-wallet unlock threshold for a depth level
     * (system_settings level.unlock_threshold_N). Defaults to the 100-per-person
     * depth tree: 100 → 10,000 → 10,00,000.
     */
    private function welcomeThreshold(int $level): int
    {
        $defaults = [1 => '100', 2 => '10000', 3 => '1000000'];
        return (int) (new SystemSettingsService())
            ->get("level.unlock_threshold_{$level}", $defaults[$level] ?? '0');
    }

    /**
     * The user's downline count at an exact depth (1/2/3). These are maintained
     * as denormalized columns (users.level_N_count), incremented up the chain on
     * every referred signup, so this is a single cheap read — no tree walk.
     */
    private function referralDepthCount(int $userId, int $depth): int
    {
        $u = (new UserModel())->find($userId);
        return (int) ($u["level_{$depth}_count"] ?? 0);
    }

    public function transactions(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        $items = (new WalletTransactionModel())
            ->where('user_id', $auth->id)
            ->orderBy('id', 'DESC')
            ->findAll(100);
        return $this->ok(['items' => $items]);
    }

    public function send(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        if (! $this->validate([
            'to_mobile' => 'required|regex_match[/^[0-9]{10}$/]',
            'amount'    => 'required|numeric|greater_than[0]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $amount   = (float) $d['amount'];
        $toMobile = trim($d['to_mobile']);
        $note     = (string) ($d['notes'] ?? '');

        $users = new UserModel();
        $sender = $users->find($auth->id);
        if ((float) ($sender['wallet_balance'] ?? 0) < $amount) return $this->fail('Insufficient balance', 402);

        // recipient must be a customer
        $recipient = $users->where('mobile_number', $toMobile)
            ->where('role', 'customer')
            ->where('status', 'active')
            ->first();
        if (! $recipient) return $this->fail('Recipient not found', 404);
        if ((int) $recipient['id'] === (int) $auth->id) return $this->fail('Cannot send to yourself', 422);

        $users->update($auth->id, ['wallet_balance' => (float) $sender['wallet_balance'] - $amount]);
        $users->update($recipient['id'], ['wallet_balance' => (float) ($recipient['wallet_balance'] ?? 0) + $amount]);

        $tx = new WalletTransactionModel();
        $tx->insert(['user_id' => $auth->id,        'peer_user_id' => $recipient['id'], 'amount' => $amount, 'type' => 'send',    'notes' => $note ?: null]);
        $tx->insert(['user_id' => $recipient['id'], 'peer_user_id' => $auth->id,        'amount' => $amount, 'type' => 'receive', 'notes' => $note ?: null]);

        (new NotificationService())->sendToUser((int) $recipient['id'], 'Money received', "₹{$amount} from " . ($sender['name'] ?? 'a user'));

        return $this->ok(null, 'Sent');
    }
}
