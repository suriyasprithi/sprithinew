<?php

namespace App\Controllers\Api;

use App\Models\UserModel;
use CodeIgniter\HTTP\ResponseInterface;

class AdminUsersController extends BaseApiController
{
    public function customers(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $q = $this->request->getGet('q');
        $statusFilter = $this->request->getGet('status');
        $p = $this->paging(20);
        $model = (new UserModel())->where('role', 'customer');
        if ($q) {
            $model->groupStart()
                ->like('name', $q)->orLike('mobile_number', $q)
                ->orLike('email', $q)->orLike('pincode', $q);
            if (ctype_digit((string) $q)) { $model->orWhere('id', (int) $q); }
            $model->groupEnd();
        }
        if (in_array($statusFilter, ['active', 'blocked', 'inactive'], true)) {
            $model->where('status', $statusFilter);
        }
        $count = clone $model;
        $total = $count->countAllResults(false);
        $items = $model->orderBy('id', 'DESC')->findAll($p['perPage'], $p['offset']);

        // Global aggregates for the stat cards (independent of search/status filter).
        $agg = db_connect()->query(
            "SELECT COUNT(*) total, SUM(status='active') active, SUM(status='blocked') blocked,
                    COALESCE(SUM(wallet_balance), 0) wallet_sum
             FROM users WHERE role = 'customer' AND deleted_at IS NULL"
        )->getRow();

        return $this->ok([
            'items' => array_map(static fn ($u) => [
                'id'             => (int) $u['id'],
                'name'           => $u['name'],
                'mobile_number'  => $u['mobile_number'],
                'email'          => $u['email'],
                'pincode'        => $u['pincode'] ?? null,
                'wallet_balance' => (float) ($u['wallet_balance'] ?? 0),
                'status'         => $u['status'],
                'created_at'     => $u['created_at'],
            ], $items),
            'total'    => $total,
            'page'     => $p['page'],
            'per_page' => $p['perPage'],
            'stats'    => [
                'total'      => (int) $agg->total,
                'active'     => (int) $agg->active,
                'blocked'    => (int) $agg->blocked,
                'wallet_sum' => (float) $agg->wallet_sum,
            ],
        ]);
    }

    public function block(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        (new UserModel())->update($id, ['status' => 'blocked']);
        return $this->ok(null, 'Blocked');
    }

    public function unblock(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        (new UserModel())->update($id, ['status' => 'active']);
        return $this->ok(null, 'Unblocked');
    }

    private function requireAdmin(): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'admin') return $this->fail('Forbidden', 403);
        return null;
    }
}
