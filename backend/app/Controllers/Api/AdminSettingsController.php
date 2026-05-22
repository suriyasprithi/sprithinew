<?php

namespace App\Controllers\Api;

use App\Services\SystemSettingsService;
use CodeIgniter\HTTP\ResponseInterface;

class AdminSettingsController extends BaseApiController
{
    public function index(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        return $this->ok((new SystemSettingsService())->all());
    }

    public function update(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        if (! is_array($d)) return $this->fail('Invalid payload', 422);
        $svc = new SystemSettingsService();
        foreach ($d as $key => $value) {
            if (! is_string($key)) continue;
            $svc->set($key, (string) $value);
        }
        return $this->ok($svc->all(), 'Saved');
    }

    private function requireAdmin(): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'admin') return $this->fail('Forbidden', 403);
        return null;
    }
}
