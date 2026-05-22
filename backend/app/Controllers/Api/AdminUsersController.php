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
        $p = $this->paging(20);
        $model = (new UserModel())->where('role', 'customer');
        if ($q) {
            $model->groupStart()->like('name', $q)->orLike('mobile_number', $q)->orLike('email', $q)->groupEnd();
        }
        $count = clone $model;
        $total = $count->countAllResults(false);
        $items = $model->orderBy('id', 'DESC')->findAll($p['perPage'], $p['offset']);
        return $this->ok([
            'items' => array_map(static fn ($u) => [
                'id'             => (int) $u['id'],
                'name'           => $u['name'],
                'mobile_number'  => $u['mobile_number'],
                'email'          => $u['email'],
                'wallet_balance' => (float) ($u['wallet_balance'] ?? 0),
                'status'         => $u['status'],
                'created_at'     => $u['created_at'],
            ], $items),
            'total'    => $total,
            'page'     => $p['page'],
            'per_page' => $p['perPage'],
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
