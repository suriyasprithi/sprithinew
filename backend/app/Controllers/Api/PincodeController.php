<?php

namespace App\Controllers\Api;

use App\Models\PincodeModel;
use CodeIgniter\HTTP\ResponseInterface;

class PincodeController extends BaseApiController
{
    public function index(): ResponseInterface
    {
        $q = (string) $this->request->getGet('q');
        $model = (new PincodeModel())->where('status', 'active');
        if ($q) $model->groupStart()->like('code', $q)->orLike('area', $q)->groupEnd();
        $rows = $model->orderBy('code', 'ASC')->findAll(50);
        return $this->ok(['items' => $rows]);
    }

    public function lookup(string $code): ResponseInterface
    {
        $row = (new PincodeModel())->where('code', $code)->first();
        if (! $row) return $this->fail('Not found', 404);
        return $this->ok($row);
    }

    public function create(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        if (! $this->validate(['code' => 'required|string|max_length[10]'])) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }
        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $id = (new PincodeModel())->insert([
            'code' => $d['code'], 'area' => $d['area'] ?? null,
            'district_id' => $d['district_id'] ?? null, 'taluk_id' => $d['taluk_id'] ?? null,
            'status' => $d['status'] ?? 'active',
        ], true);
        return $this->ok(['id' => (int) $id], 'Created');
    }

    public function update(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $payload = array_intersect_key($d, array_flip(['code', 'area', 'district_id', 'taluk_id', 'status']));
        if (! $payload) return $this->fail('Nothing to update', 422);
        (new PincodeModel())->update($id, $payload);
        return $this->ok(null, 'Updated');
    }

    public function delete(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        (new PincodeModel())->delete($id);
        return $this->ok(null, 'Deleted');
    }

    private function requireAdmin(): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'admin') return $this->fail('Forbidden', 403);
        return null;
    }
}
