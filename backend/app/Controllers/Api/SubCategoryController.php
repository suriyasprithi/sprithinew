<?php

namespace App\Controllers\Api;

use App\Models\SubCategoryModel;
use App\Models\CategoryModel;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Sub Category CRUD (Vendor Category → Product Category → Sub Category).
 * Sub-categories are the leaf level; each belongs to one product category.
 */
class SubCategoryController extends BaseApiController
{
    /**
     * Public + auth list. `?category_id=N` restricts to one product category's
     * sub-categories — used by the product form's third cascade and by customer
     * filters. Without it, returns all active sub-categories.
     */
    public function index(): ResponseInterface
    {
        $model = (new SubCategoryModel())->where('status', 'active');
        $cid   = (int) $this->request->getGet('category_id');
        if ($cid > 0) $model->where('category_id', $cid);
        $items = array_map([$this, 'decode'], $model->orderBy('name', 'ASC')->findAll());
        return $this->ok(['items' => $items]);
    }

    /** Admin: all sub-categories with their parent product-category name. */
    public function adminIndex(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $items = array_map([$this, 'decode'], (new SubCategoryModel())->orderBy('id', 'DESC')->findAll());

        $catIds = array_values(array_unique(array_filter(
            array_map(static fn ($i) => (int) ($i['category_id'] ?? 0), $items)
        )));
        $catName = [];
        if ($catIds) {
            foreach ((new CategoryModel())->whereIn('id', $catIds)->findAll() as $c) {
                $catName[(int) $c['id']] = $c['name'];
            }
        }
        foreach ($items as &$it) {
            $it['category_name'] = $catName[(int) ($it['category_id'] ?? 0)] ?? null;
        }
        unset($it);

        return $this->ok(['items' => $items]);
    }

    public function create(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        if (! $this->validate([
            'name'        => 'required|string|max_length[100]',
            'category_id' => 'required|is_natural_no_zero',
        ])) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }
        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        $id = (new SubCategoryModel())->insert([
            'category_id' => (int) $data['category_id'],
            'name'        => trim((string) $data['name']),
            'status'      => $data['status'] ?? 'active',
        ], true);
        return $this->ok(['id' => (int) $id], 'Created');
    }

    public function update(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $data    = $this->request->getJSON(true) ?? $this->request->getPost();
        $payload = [];
        if (array_key_exists('name', $data) && trim((string) $data['name']) !== '') $payload['name'] = trim((string) $data['name']);
        if (array_key_exists('status', $data)) $payload['status'] = $data['status'];
        if (array_key_exists('category_id', $data) && $data['category_id'] !== '' && $data['category_id'] !== null) {
            $payload['category_id'] = (int) $data['category_id'];
        }
        if (! $payload) return $this->fail('Nothing to update', 422);
        (new SubCategoryModel())->update($id, $payload);
        return $this->ok(null, 'Updated');
    }

    public function delete(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        (new SubCategoryModel())->delete($id);
        return $this->ok(null, 'Deleted');
    }

    /**
     * Ensure sub-categories exist under a product category and return their ids —
     * used by the CSV import "create missing sub-categories" flow. Matching is
     * case-insensitive per parent category so we never create near-duplicates.
     * Body: { category_id: int, names: string[] }
     * Returns: { items: [ { name, id, created } ] }
     */
    public function ensure(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, ['vendor', 'admin'], true)) return $this->fail('Forbidden', 403);

        $data  = $this->request->getJSON(true) ?? $this->request->getPost();
        $catId = (int) ($data['category_id'] ?? 0);
        $names = $data['names'] ?? null;
        if ($catId <= 0)      return $this->fail('category_id required', 422);
        if (! is_array($names)) return $this->fail('No sub-category names provided', 422);

        $model = new SubCategoryModel();
        $byLower = [];
        foreach ($model->where('category_id', $catId)->select('id, name')->findAll() as $s) {
            $byLower[mb_strtolower(trim((string) $s['name']))] = (int) $s['id'];
        }

        $items = []; $done = [];
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
            $id = (int) $model->insert(['category_id' => $catId, 'name' => $name, 'status' => 'active'], true);
            $byLower[$key] = $id;
            $items[] = ['name' => $name, 'id' => $id, 'created' => true];
        }

        return $this->ok(['items' => $items], 'Sub-categories ready');
    }

    private function requireAdmin(): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'admin') return $this->fail('Forbidden', 403);
        return null;
    }

    private function decode(array $row): array
    {
        $row['id']          = (int) $row['id'];
        $row['category_id'] = isset($row['category_id']) ? (int) $row['category_id'] : null;
        return $row;
    }
}
