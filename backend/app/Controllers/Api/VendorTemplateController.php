<?php

namespace App\Controllers\Api;

use App\Models\VendorTemplateModel;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Admin-only reusable vendor presets (category + commission) used to pre-fill
 * the New-vendor form when onboarding similar vendors.
 */
class VendorTemplateController extends BaseApiController
{
    public function index(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $rows = (new VendorTemplateModel())->orderBy('name', 'ASC')->findAll(200);
        $items = array_map(static fn ($t) => [
            'id'                 => (int) $t['id'],
            'name'               => $t['name'],
            'vendor_category_id' => $t['vendor_category_id'] !== null ? (int) $t['vendor_category_id'] : null,
            'commission_pct'     => (float) ($t['commission_pct'] ?? 0),
        ], $rows);
        return $this->ok(['items' => $items]);
    }

    public function store(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        if (! $this->validate([
            'name'               => 'required|string|max_length[150]',
            'vendor_category_id' => 'required|is_natural_no_zero',
            'commission_pct'     => 'permit_empty|numeric',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d  = $this->request->getJSON(true) ?? $this->request->getPost();
        $id = (new VendorTemplateModel())->insert([
            'name'               => trim($d['name']),
            'vendor_category_id' => (int) $d['vendor_category_id'],
            'commission_pct'     => isset($d['commission_pct']) ? (float) $d['commission_pct'] : 10.00,
            'created_by'         => (int) $this->authUser()->id,
        ], true);
        return $this->ok(['id' => (int) $id], 'Created');
    }

    public function destroy(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        (new VendorTemplateModel())->delete($id);
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
