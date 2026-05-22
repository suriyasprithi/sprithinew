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
        (new WalletService())->credit($userId, 'global', $amount, 'lucky_draw', $ref, "Lucky draw {$row['period']}");

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
