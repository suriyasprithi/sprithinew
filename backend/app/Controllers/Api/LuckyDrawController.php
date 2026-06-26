<?php

namespace App\Controllers\Api;

use App\Models\MonthlyLuckyDrawPoolModel;
use App\Models\UserModel;
use App\Services\WalletService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Admin-managed monthly Lucky Draw pool.
 *
 * Money flow:
 *   CommissionService.distributeForOrder()
 *     → 3% of every order's pool → monthly_lucky_draw_pools[YYYY-MM].collected
 *
 * Winner picking:
 *   Admin opens /admin/lucky-draw, sees pool rows per month, clicks "Pick winner"
 *   on any row not yet distributed. Picks ONE customer by mobile/id, sets amount
 *   (defaults to row's `collected`), and submits. Endpoint credits the user's
 *   global_wallet, writes a wallet_transactions audit row, and stamps the pool row.
 */
class LuckyDrawController extends BaseApiController
{
    /** List all monthly lucky-draw pool rows, newest first. */
    public function pools(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $rows = (new MonthlyLuckyDrawPoolModel())->orderBy('period', 'DESC')->findAll(120);

        // Enrich winner_user_id with name + mobile for display.
        $winnerIds = array_values(array_filter(array_map(static fn ($r) => (int) ($r['winner_user_id'] ?? 0), $rows)));
        $byId = [];
        if ($winnerIds) {
            $users = (new UserModel())->whereIn('id', $winnerIds)->findAll();
            foreach ($users as $u) $byId[(int) $u['id']] = $u;
        }

        $items = array_map(static function ($r) use ($byId) {
            $wid = (int) ($r['winner_user_id'] ?? 0);
            $w   = $wid ? ($byId[$wid] ?? null) : null;
            return [
                'id'             => (int) $r['id'],
                'period'         => $r['period'],
                'collected'      => (float) ($r['collected'] ?? 0),
                'distributed'    => (float) ($r['distributed'] ?? 0),
                'winner_user_id' => $wid ?: null,
                'winner_name'    => $w['name'] ?? null,
                'winner_mobile'  => $w['mobile_number'] ?? null,
                'winner_amount'  => (float) ($r['winner_amount'] ?? 0),
                'distributed_at' => $r['distributed_at'],
                'notes'          => $r['notes'],
            ];
        }, $rows);

        return $this->ok(['items' => $items]);
    }

    /**
     * Imported legacy lucky-draw raffle entries (from the old `lucky_draw` table),
     * newest first, paginated. Separate from the V2 monthly pools above.
     */
    public function entries(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $p  = $this->paging(20);
        $db = db_connect();

        $total = $db->table('lucky_draw_entries')->countAllResults();
        $rows  = $db->table('lucky_draw_entries')->orderBy('id', 'DESC')
            ->get($p['perPage'], $p['offset'])->getResultArray();

        // Resolve vendor + taluk names where the legacy ids mapped.
        $vendorIds = array_values(array_unique(array_filter(array_map(static fn ($r) => (int) ($r['vendor_id'] ?? 0), $rows))));
        $talukIds  = array_values(array_unique(array_filter(array_map(static fn ($r) => (int) ($r['taluk_id'] ?? 0), $rows))));
        $vById = [];
        $tById = [];
        if ($vendorIds) { foreach ($db->table('users')->whereIn('id', $vendorIds)->get()->getResultArray() as $u) $vById[(int) $u['id']] = $u['name']; }
        if ($talukIds)  { foreach ($db->table('taluks')->whereIn('id', $talukIds)->get()->getResultArray() as $t) $tById[(int) $t['id']] = $t['name']; }

        $items = array_map(static fn ($r) => [
            'id'            => (int) $r['id'],
            'refer_code'    => $r['refer_code'],
            'mobile_number' => $r['mobile_number'],
            'vendor_name'   => $vById[(int) ($r['vendor_id'] ?? 0)] ?? null,
            'taluk_name'    => $tById[(int) ($r['taluk_id'] ?? 0)] ?? null,
            'status'        => (int) ($r['status'] ?? 0),
            'created_at'    => $r['created_at'],
        ], $rows);

        return $this->ok([
            'items'    => $items,
            'total'    => $total,
            'page'     => $p['page'],
            'per_page' => $p['perPage'],
        ]);
    }

    /** Pick a winner for a specific pool row. Idempotent — errors if already distributed. */
    public function pickWinner(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        if (! $this->validate([
            'user_id' => 'required|integer',
            'amount'  => 'permit_empty|decimal',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $pools = new MonthlyLuckyDrawPoolModel();
        $row = $pools->find($id);
        if (! $row) return $this->fail('Pool not found', 404);
        if (! empty($row['distributed_at'])) return $this->fail('This pool was already distributed', 409);

        $userId = (int) $d['user_id'];
        $user   = (new UserModel())->find($userId);
        if (! $user || $user['role'] !== 'customer' || $user['status'] !== 'active') {
            return $this->fail('Winner must be an active customer', 422);
        }

        $collected = (float) ($row['collected'] ?? 0);
        if ($collected <= 0) return $this->fail('Pool has nothing to distribute', 422);

        $amount = isset($d['amount']) && $d['amount'] !== '' ? round((float) $d['amount'], 2) : $collected;
        if ($amount <= 0) return $this->fail('Amount must be positive', 422);
        if ($amount > $collected) return $this->fail('Amount exceeds pool collected', 422);

        $ref = 'lucky#' . $row['period'];
        // The lucky money lives in the admin's main wallet (credited at order
        // time). Move it from there to the winner so it isn't paid twice.
        $wallet      = new WalletService();
        $mainAdminId = (new UserModel())->mainAdminId();
        if ($mainAdminId && ! $wallet->debit($mainAdminId, 'wallet', $amount, 'lucky_draw', $ref, "Lucky draw payout {$row['period']}")) {
            return $this->fail('Admin main wallet has insufficient balance for this payout', 422);
        }
        $wallet->credit($userId, 'global', $amount, 'lucky_draw', $ref, "Lucky draw {$row['period']}");

        $pools->update($id, [
            'distributed'    => $amount,
            'winner_user_id' => $userId,
            'winner_amount'  => $amount,
            'distributed_at' => date('Y-m-d H:i:s'),
            'notes'          => trim(($row['notes'] ?? '') . " | picked by admin: ₹" . number_format($amount, 2) . " → user#{$userId}"),
        ]);

        return $this->ok([
            'pool_id'       => $id,
            'winner_user_id'=> $userId,
            'amount'        => $amount,
        ], 'Winner picked');
    }

    private function requireAdmin(): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'admin') return $this->fail('Forbidden', 403);
        return null;
    }
}
