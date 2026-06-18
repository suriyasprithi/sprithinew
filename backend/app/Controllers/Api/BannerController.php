<?php

namespace App\Controllers\Api;

use App\Models\HomeBannerModel;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Home banners CRUD + public read.
 *
 * Public:
 *   GET  /public/banners              → all active banners grouped by slot
 *
 * Admin (auth + role=admin):
 *   GET    /admin/banners             → list all (incl. inactive)
 *   POST   /admin/banners             → create
 *   PATCH  /admin/banners/{id}        → update (partial)
 *   DELETE /admin/banners/{id}        → delete
 */
class BannerController extends BaseApiController
{
    /** Public — grouped by slot. */
    public function publicIndex(): ResponseInterface
    {
        $bySlot = (new HomeBannerModel())->activeBySlot();
        return $this->ok(['by_slot' => $bySlot]);
    }

    /** Admin — flat list with sort_order ASC inside each slot. */
    public function adminIndex(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth || $auth->role !== 'admin') return $this->fail('Forbidden', 403);

        $rows = (new HomeBannerModel())
            ->orderBy('slot', 'ASC')
            ->orderBy('sort_order', 'ASC')
            ->orderBy('id', 'ASC')
            ->findAll();
        return $this->ok(['items' => $rows]);
    }

    public function create(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth || $auth->role !== 'admin') return $this->fail('Forbidden', 403);

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $payload = $this->buildPayload($d);
        if (! $payload['slot']) return $this->fail('slot is required', 422);
        if (! in_array($payload['slot'], HomeBannerModel::SLOTS, true)) {
            return $this->fail('Invalid slot. Allowed: ' . implode(', ', HomeBannerModel::SLOTS), 422);
        }
        $id = (new HomeBannerModel())->insert($payload, true);
        return $this->ok(['id' => (int) $id], 'Created');
    }

    public function update(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth || $auth->role !== 'admin') return $this->fail('Forbidden', 403);

        $model = new HomeBannerModel();
        if (! $model->find($id)) return $this->fail('Not found', 404);

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $payload = $this->buildPayload($d, /* forUpdate */ true);
        if (isset($payload['slot']) && ! in_array($payload['slot'], HomeBannerModel::SLOTS, true)) {
            return $this->fail('Invalid slot. Allowed: ' . implode(', ', HomeBannerModel::SLOTS), 422);
        }
        if (! $payload) return $this->fail('Nothing to update', 422);
        $model->update($id, $payload);
        return $this->ok(null, 'Updated');
    }

    public function delete(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth || $auth->role !== 'admin') return $this->fail('Forbidden', 403);

        (new HomeBannerModel())->delete($id);
        return $this->ok(null, 'Deleted');
    }

    /** Whitelist + light validation. For update mode, only set keys that are present in input. */
    private function buildPayload(array $d, bool $forUpdate = false): array
    {
        $payload = [];
        $string = ['slot', 'eyebrow', 'title', 'highlight', 'subtitle', 'cta_label', 'cta_href',
                   'image_url', 'gradient_from', 'gradient_mid', 'gradient_to', 'icon_name'];
        foreach ($string as $k) {
            if ($forUpdate ? array_key_exists($k, $d) : true) {
                $val = $d[$k] ?? null;
                if (is_string($val)) $val = trim($val);
                if ($val === '') $val = null;
                $payload[$k] = $val;
            }
        }
        // Oversized / base64 hero images → small on-disk file so /home stays light.
        if (isset($payload['image_url']) && $payload['image_url'] !== null) {
            $payload['image_url'] = \App\Libraries\ImageOptimizer::fromDataUri($payload['image_url'], 'banners');
        }
        if (array_key_exists('sort_order', $d)) $payload['sort_order'] = (int) $d['sort_order'];
        if (array_key_exists('status', $d) && in_array($d['status'], ['active','inactive'], true)) {
            $payload['status'] = $d['status'];
        }
        // For create, default sort_order to 0 if not provided
        if (! $forUpdate && ! isset($payload['sort_order'])) $payload['sort_order'] = 0;
        if (! $forUpdate && ! isset($payload['status']))     $payload['status']     = 'active';

        // Drop fully-null entries on update so caller can pass {status: 'inactive'} alone.
        if ($forUpdate) {
            foreach ($payload as $k => $v) {
                if ($v === null && ! array_key_exists($k, $d)) unset($payload[$k]);
            }
        }
        return $payload;
    }
}
