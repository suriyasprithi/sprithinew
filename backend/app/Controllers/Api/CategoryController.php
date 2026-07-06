<?php

namespace App\Controllers\Api;

use App\Models\CategoryModel;
use App\Models\VendorCategoryModel;
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
        // Top-level categories only — auto-created sub-categories (parent_id set)
        // are leaves and must not appear in the public/vendor top-level pickers.
        $model = (new CategoryModel())->where('status', 'active')->where('parent_id', null);
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
        // sort_order (per vendor category) drives the admin list + the customer
        // rails; optional ?vendor_category_id=N narrows to one group.
        $model = (new CategoryModel())->orderBy('sort_order', 'ASC')->orderBy('id', 'ASC');
        $vcid  = (int) $this->request->getGet('vendor_category_id');
        if ($vcid > 0) $model->where('vendor_category_id', $vcid);
        $items = $model->findAll();
        $items = array_map([$this, 'decode'], $items);

        // Attach the linked vendor category's name so the admin table can show it
        // directly — no separate /admin/vendor-categories lookup on the client.
        $vcIds = array_values(array_unique(array_filter(
            array_map(static fn ($i) => (int) ($i['vendor_category_id'] ?? 0), $items)
        )));
        $vcName = [];
        if ($vcIds) {
            foreach ((new VendorCategoryModel())->whereIn('id', $vcIds)->findAll() as $v) {
                $vcName[(int) $v['id']] = $v['name'];
            }
        }
        foreach ($items as &$it) {
            $vid = (int) ($it['vendor_category_id'] ?? 0);
            $it['vendor_category_name'] = $vid ? ($vcName[$vid] ?? null) : null;
        }
        unset($it);

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
     * Admin: the product-category ids that shops IN a given vendor category
     * actually stock (active products), regardless of each category's stored
     * vendor_category_id. Powers the usage-based filter on the Product Categories
     * page — imported links are unreliable, so admin filters by what a vendor
     * category's shops really use (matching the customer browse) instead.
     */
    public function usedByVendorCategory(int $vendorCategoryId): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $rows = \Config\Database::connect()->table('products p')
            ->select('p.category_id', false)->distinct()
            ->join('vendor_profiles vp', 'vp.user_id = p.vendor_id')
            ->where('vp.vendor_category_id', $vendorCategoryId)
            ->where('p.status', 'active')
            ->where('p.deleted_at', null)
            ->where('p.category_id IS NOT NULL')
            ->get()->getResultArray();
        $ids = array_values(array_map(static fn ($r) => (int) $r['category_id'], $rows));
        return $this->ok(['ids' => $ids]);
    }

    /**
     * Admin: bulk reorder product categories within one vendor category. Body:
     * { "ids": [12, 4, 9, ...] } — the product-category ids in their new visual
     * order (all belonging to the same vendor category). Positions 1..N are
     * written into sort_order. Wrapped in a transaction. Mirrors
     * VendorCategoryController::reorder.
     */
    public function reorder(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;

        $d   = $this->request->getJSON(true) ?? $this->request->getPost();
        $ids = $d['ids'] ?? null;
        if (! is_array($ids) || empty($ids)) return $this->fail('ids array required', 422);

        $clean = [];
        foreach ($ids as $v) {
            $n = (int) $v;
            if ($n > 0 && ! in_array($n, $clean, true)) $clean[] = $n;
        }
        if (empty($clean)) return $this->fail('ids array required', 422);

        $db = \Config\Database::connect();
        $db->transStart();
        $pos = 1;
        foreach ($clean as $id) {
            $db->table('categories')->where('id', $id)->update(['sort_order' => $pos++]);
        }
        $db->transComplete();
        if ($db->transStatus() === false) return $this->fail('Reorder failed', 500);

        return $this->ok(null, 'Reordered');
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
