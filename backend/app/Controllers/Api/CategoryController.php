<?php

namespace App\Controllers\Api;

use App\Models\CategoryModel;
use App\Models\VendorProfileModel;
use CodeIgniter\HTTP\ResponseInterface;

class CategoryController extends BaseApiController
{
    /**
     * Public + auth list. Optional ?vendor_category_id=N restricts to product
     * categories that belong to that vendor category — used by the vendor's
     * product form so the dropdown only shows the categories that apply to
     * the vendor's own vendor_category.
     */
    public function index(): ResponseInterface
    {
        $model = (new CategoryModel())->where('status', 'active');
        $vcid  = (int) $this->request->getGet('vendor_category_id');
        if ($vcid > 0) {
            $model->where('vendor_category_id', $vcid);
        }
        $items = $model->orderBy('name', 'ASC')->findAll();
        $items = array_map([$this, 'decode'], $items);
        return $this->ok(['items' => $items]);
    }

    public function adminIndex(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $items = (new CategoryModel())->orderBy('id', 'DESC')->findAll();
        $items = array_map([$this, 'decode'], $items);
        return $this->ok(['items' => $items]);
    }

    public function create(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        if (! $this->validate(['name' => 'required|string|max_length[100]'])) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }
        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        $id = (new CategoryModel())->insert([
            'name'               => $data['name'],
            'vendor_category_id' => isset($data['vendor_category_id']) && $data['vendor_category_id'] !== ''
                ? (int) $data['vendor_category_id']
                : null,
            'status'             => $data['status'] ?? 'active',
        ], true);
        return $this->ok(['id' => (int) $id], 'Created');
    }

    public function update(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        $payload = array_intersect_key($data, array_flip(['name', 'status']));
        if (array_key_exists('vendor_category_id', $data)) {
            $payload['vendor_category_id'] = $data['vendor_category_id'] === null || $data['vendor_category_id'] === ''
                ? null
                : (int) $data['vendor_category_id'];
        }
        if (! $payload) return $this->fail('Nothing to update', 422);
        (new CategoryModel())->update($id, $payload);
        return $this->ok(null, 'Updated');
    }

    public function delete(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        (new CategoryModel())->delete($id);
        return $this->ok(null, 'Deleted');
    }

    /**
     * Ensure a set of product categories exist and return their ids — used by the
     * CSV import "create missing categories" flow. Available to vendors (filed
     * under their own vendor_category) and admins (vendor_category_id from payload).
     * Matching is case-insensitive so we never create near-duplicate categories.
     * Body: { names: string[], vendor_category_id?: int }
     * Returns: { items: [ { name, id, created } ] }
     */
    public function ensure(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, ['vendor', 'admin'], true)) return $this->fail('Forbidden', 403);

        $data  = $this->request->getJSON(true) ?? $this->request->getPost();
        $names = $data['names'] ?? null;
        if (! is_array($names)) return $this->fail('No category names provided', 422);

        // Which vendor_category new categories are filed under.
        $vendorCategoryId = null;
        if ($auth->role === 'vendor') {
            $profile = (new VendorProfileModel())->where('user_id', $auth->id)->first();
            $vendorCategoryId = $profile && $profile['vendor_category_id'] !== null ? (int) $profile['vendor_category_id'] : null;
        } elseif (isset($data['vendor_category_id']) && $data['vendor_category_id'] !== '') {
            $vendorCategoryId = (int) $data['vendor_category_id'];
        }

        $model = new CategoryModel();
        // Case-insensitive lookup of existing names (kept in memory; tiny table).
        $byLower = [];
        foreach ($model->select('id, name')->findAll() as $c) {
            $byLower[mb_strtolower(trim((string) $c['name']))] = (int) $c['id'];
        }

        $items = [];
        $done  = [];
        foreach ($names as $raw) {
            $name = trim((string) $raw);
            if ($name === '') continue;
            $key = mb_strtolower($name);
            if (isset($done[$key])) continue;
            $done[$key] = true;

            if (isset($byLower[$key])) {
                $items[] = ['name' => $name, 'id' => $byLower[$key], 'created' => false];
                continue;
            }
            $id = (int) $model->insert([
                'name'               => $name,
                'vendor_category_id' => $vendorCategoryId,
                'status'             => 'active',
            ], true);
            $byLower[$key] = $id;
            $items[] = ['name' => $name, 'id' => $id, 'created' => true];
        }

        return $this->ok(['items' => $items], 'Categories ready');
    }

    private function requireAdmin(): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'admin') return $this->fail('Forbidden', 403);
        return null;
    }

    /** Cast vendor_category_id for the frontend. */
    private function decode(array $row): array
    {
        $row['vendor_category_id'] = isset($row['vendor_category_id']) ? (int) $row['vendor_category_id'] : null;
        return $row;
    }
}
