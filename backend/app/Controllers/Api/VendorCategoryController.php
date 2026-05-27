<?php

namespace App\Controllers\Api;

use App\Models\VendorCategoryModel;
use App\Models\VendorProfileModel;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

class VendorCategoryController extends BaseApiController
{
    /** Public list — used by registration form and customer home page. */
    public function index(): ResponseInterface
    {
        // Optional location filter (chosen by customer via location picker).
        // When present, product_count reflects only products whose vendor
        // is in the chosen taluk/district/state.
        $talukId    = (int) $this->request->getGet('taluk_id');
        $districtId = (int) $this->request->getGet('district_id');
        $stateId    = (int) $this->request->getGet('state_id');

        $locJoin = '';
        $locWhere = '';
        if ($talukId > 0 || $districtId > 0 || $stateId > 0) {
            $locJoin = ' JOIN vendor_profiles vp ON vp.user_id = p.vendor_id';
            $clauses = [];
            if ($talukId > 0)    $clauses[] = 'vp.taluk_id = ' . $talukId;
            elseif ($districtId > 0) $clauses[] = 'vp.district_id = ' . $districtId;
            elseif ($stateId > 0)    $clauses[] = 'vp.state_id = ' . $stateId;
            $locWhere = ' AND ' . implode(' AND ', $clauses);
        }

        // Count active, non-deleted products either linked directly via
        // products.vendor_category_id OR via products.category_id → categories.vendor_category_id.
        // Use COUNT(DISTINCT p.id) so a row matched by both paths isn't double-counted.
        $countExpr = '('
            . 'SELECT COUNT(DISTINCT p.id) FROM products p '
            . 'LEFT JOIN categories c ON c.id = p.category_id'
            . $locJoin . ' '
            . 'WHERE (p.vendor_category_id = vendor_categories.id OR c.vendor_category_id = vendor_categories.id) '
            . 'AND p.status = "active" AND p.deleted_at IS NULL'
            . $locWhere
            . ') AS product_count';

        $rows = (new VendorCategoryModel())
            ->select('vendor_categories.*, ' . $countExpr)
            ->where('status', 'active')
            ->orderBy('display_order', 'ASC')
            ->orderBy('id', 'ASC')
            ->findAll();

        // When a location is set, hide categories with 0 matching products so
        // the customer doesn't see empty options for their area.
        if ($talukId > 0 || $districtId > 0 || $stateId > 0) {
            $rows = array_values(array_filter($rows, static fn ($r) => (int) $r['product_count'] > 0));
        }

        return $this->ok(['items' => $rows]);
    }

    /** Admin: full list including inactive. */
    public function adminIndex(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth || $auth->role !== 'admin') return $this->fail('Forbidden', 403);

        $rows = (new VendorCategoryModel())
            ->orderBy('display_order', 'ASC')
            ->orderBy('id', 'ASC')
            ->findAll();
        return $this->ok(['items' => $rows]);
    }

    /**
     * Admin: bulk reorder. Body: { "ids": [3, 1, 4, 2] } — array of all
     * vendor category ids in their new visual order. Indexes 1..N are
     * written into display_order so the next list call returns them in
     * this exact order.
     *
     * Wrapped in a transaction so a mid-write failure leaves the table
     * untouched.
     */
    public function reorder(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth || $auth->role !== 'admin') return $this->fail('Forbidden', 403);

        $d   = $this->request->getJSON(true) ?? $this->request->getPost();
        $ids = $d['ids'] ?? null;
        if (! is_array($ids) || empty($ids)) {
            return $this->fail('ids array required', 422);
        }
        $clean = [];
        foreach ($ids as $v) {
            $n = (int) $v;
            if ($n > 0 && ! in_array($n, $clean, true)) $clean[] = $n;
        }
        if (empty($clean)) return $this->fail('ids array required', 422);

        $db = Database::connect();
        $db->transStart();
        $pos = 1;
        foreach ($clean as $id) {
            $db->table('vendor_categories')->where('id', $id)->update(['display_order' => $pos++]);
        }
        $db->transComplete();
        if ($db->transStatus() === false) {
            return $this->fail('Reorder failed', 500);
        }
        return $this->ok(null, 'Reordered');
    }

    /** Admin: create a vendor category. */
    public function create(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth || $auth->role !== 'admin') return $this->fail('Forbidden', 403);

        if (! $this->validate(['name' => 'required|string|max_length[100]'])) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }
        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $id = (new VendorCategoryModel())->insert([
            'name'   => trim((string) $d['name']),
            'image'  => $d['image']  ?? null,
            'status' => in_array($d['status'] ?? 'active', ['active', 'inactive'], true) ? $d['status'] : 'active',
        ], true);
        return $this->ok(['id' => (int) $id], 'Created');
    }

    /** Admin: update a vendor category. */
    public function update(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth || $auth->role !== 'admin') return $this->fail('Forbidden', 403);

        $model = new VendorCategoryModel();
        if (! $model->find($id)) return $this->fail('Not found', 404);

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $payload = [];
        if (isset($d['name']))   $payload['name']  = trim((string) $d['name']);
        if (array_key_exists('image', $d)) $payload['image'] = $d['image'];
        if (isset($d['status']) && in_array($d['status'], ['active', 'inactive'], true)) {
            $payload['status'] = $d['status'];
        }
        if (! $payload) return $this->fail('Nothing to update', 422);
        $model->update($id, $payload);
        return $this->ok(null, 'Updated');
    }

    /** Admin: delete a vendor category. */
    public function delete(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth || $auth->role !== 'admin') return $this->fail('Forbidden', 403);

        (new VendorCategoryModel())->delete($id);
        return $this->ok(null, 'Deleted');
    }

    /** Vendor: my own category (id + name + image). Used by the product form
     *  to filter the product-category dropdown. Schema is no longer here —
     *  it lives on product categories now. */
    public function mine(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, ['vendor', 'admin'], true)) return $this->fail('Forbidden', 403);

        $profile = (new VendorProfileModel())->where('user_id', $auth->id)->first();
        if (! $profile || empty($profile['vendor_category_id'])) {
            return $this->ok(['category' => null]);
        }
        $row = (new VendorCategoryModel())->find((int) $profile['vendor_category_id']);
        return $this->ok(['category' => $row ?: null]);
    }
}
