<?php

namespace App\Controllers\Api;

use App\Models\CategoryModel;
use App\Models\ProductModel;
use App\Models\UserModel;
use App\Models\VendorProfileModel;
use CodeIgniter\HTTP\ResponseInterface;

class ShopController extends BaseApiController
{
    /** Customer-facing shop list — no district/taluk filter. */
    public function customerIndex(): ResponseInterface
    {
        $q       = (string) $this->request->getGet('q');
        $catId   = (int) $this->request->getGet('category_id');
        $talukId = (int) $this->request->getGet('taluk_id');

        $users = (new UserModel())->where('role', 'vendor')->where('status', 'active');
        if ($talukId > 0) {
            $talukVendorIds = (new VendorProfileModel())->where('taluk_id', $talukId)->findColumn('user_id') ?: [];
            if (empty($talukVendorIds)) return $this->ok(['items' => []]);
            $users->whereIn('id', $talukVendorIds);
        }
        if ($q) $users->groupStart()
            ->like('name', $q)
            ->orLike('mobile_number', $q)
            ->groupEnd();
        $rows = $users->orderBy('id', 'DESC')->findAll(100);
        if (! $rows) return $this->ok(['items' => []]);

        $userIds = array_map(static fn ($u) => (int) $u['id'], $rows);
        $profiles = (new VendorProfileModel())->whereIn('user_id', $userIds)->findAll();
        $byId = []; foreach ($profiles as $p) $byId[(int) $p['user_id']] = $p;

        // Optional category filter — keep only vendors that sell something in that category.
        if ($catId) {
            $vendorIdsWithCat = (new ProductModel())
                ->where('category_id', $catId)
                ->where('status', 'active')
                ->whereIn('vendor_id', $userIds)
                ->groupBy('vendor_id')
                ->findColumn('vendor_id') ?: [];
            $vendorIdsWithCat = array_map('intval', $vendorIdsWithCat);
            $rows = array_values(array_filter($rows, static fn ($u) => in_array((int) $u['id'], $vendorIdsWithCat, true)));
        }

        // Count active products per vendor in one query.
        $counts = (new ProductModel())
            ->select('vendor_id, COUNT(*) AS c')
            ->whereIn('vendor_id', $userIds)
            ->where('status', 'active')
            ->groupBy('vendor_id')
            ->findAll();
        $countBy = []; foreach ($counts as $c) $countBy[(int) $c['vendor_id']] = (int) $c['c'];

        $items = array_map(static fn ($u) => [
            'id'            => (int) $u['id'],
            'name'          => $byId[(int) $u['id']]['shop_name'] ?? $u['name'],
            'address'       => $byId[(int) $u['id']]['address'] ?? '',
            'area'          => $byId[(int) $u['id']]['area']    ?? '',
            'pincode'       => $byId[(int) $u['id']]['pincode'] ?? '',
            'mobile'        => $u['mobile_number']              ?? '',
            'image'         => $byId[(int) $u['id']]['image']   ?? '',
            'product_count' => $countBy[(int) $u['id']] ?? 0,
        ], $rows);

        if ($q) {
            $needle = strtolower($q);
            $items = array_values(array_filter($items, static function ($it) use ($needle) {
                $hay = strtolower(($it['name'] ?? '') . ' ' . ($it['area'] ?? '') . ' ' . ($it['pincode'] ?? '') . ' ' . ($it['mobile'] ?? ''));
                return str_contains($hay, $needle);
            }));
        }

        return $this->ok(['items' => $items]);
    }

    /** One shop with its active products. */
    public function customerShow(int $vendorId): ResponseInterface
    {
        $vendor = (new UserModel())->where('id', $vendorId)->where('role', 'vendor')->where('status', 'active')->first();
        if (! $vendor) return $this->fail('Shop not found', 404);
        $profile = (new VendorProfileModel())->find($vendorId);

        $catId = (int) $this->request->getGet('category_id');
        $q     = (string) $this->request->getGet('q');
        $pm = (new ProductModel())->where('vendor_id', $vendorId)->where('status', 'active');
        if ($catId) $pm->where('category_id', $catId);
        if ($q) $pm->like('name', $q);
        $products = $pm->orderBy('id', 'DESC')->findAll(200);

        // Enrich products with category_name + vendor_name (= shop_name)
        $catIds = array_unique(array_filter(array_map(static fn ($p) => (int) ($p['category_id'] ?? 0), $products)));
        $cats   = $catIds ? (new CategoryModel())->whereIn('id', $catIds)->findAll() : [];
        $catMap = []; foreach ($cats as $c) $catMap[(int) $c['id']] = $c['name'];
        $shopName = $profile['shop_name'] ?? $vendor['name'];
        $products = array_map(static fn ($p) => $p + [
            'category_name' => $catMap[(int) ($p['category_id'] ?? 0)] ?? null,
            'vendor_name'   => $shopName,
            'price'         => (float) ($p['price'] ?? 0),
            'stock'         => (int)   ($p['stock'] ?? 0),
            'has_variants'  => (bool)  ($p['has_variants'] ?? 0),
        ], $products);

        $allCats = (new CategoryModel())->where('status', 'active')->findAll();

        return $this->ok([
            'shop' => [
                'id'        => (int) $vendor['id'],
                'name'      => $shopName,
                'shop_name' => $shopName,
                'area'      => $profile['area']    ?? '',
                'pincode'   => $profile['pincode'] ?? '',
                'address'   => $profile['address'] ?? '',
                'image'     => $profile['image']   ?? '',
                'product_count' => count($products),
            ],
            'products'   => $products,
            'categories' => $allCats,
        ]);
    }

    /** Staff/admin shop list with district/taluk/state filters. */
    public function adminIndex(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, ['vendor','taluk','district','state','admin'], true)) return $this->fail('Forbidden', 403);

        $q          = (string) $this->request->getGet('q');
        $districtId = (int) $this->request->getGet('district_id');
        $talukId    = (int) $this->request->getGet('taluk_id');
        $stateId    = (int) $this->request->getGet('state_id');

        $vp = new VendorProfileModel();
        if ($districtId) $vp->where('district_id', $districtId);
        if ($talukId)    $vp->where('taluk_id', $talukId);
        if ($stateId)    $vp->where('state_id', $stateId);
        $profiles = $vp->findAll();
        $byId = []; foreach ($profiles as $p) $byId[(int) $p['user_id']] = $p;
        $userIds = array_keys($byId);
        if (! $userIds && ($districtId || $talukId || $stateId)) return $this->ok(['items' => []]);

        $users = (new UserModel())->where('role', 'vendor');
        if ($userIds) $users->whereIn('id', $userIds);
        if ($q) $users->like('name', $q);
        $rows = $users->orderBy('id', 'DESC')->findAll(200);

        $items = array_map(static fn ($u) => [
            'id'          => (int) $u['id'],
            'name'        => $u['name'],
            'mobile'      => $u['mobile_number'],
            'status'      => $u['status'],
            'shop_name'   => $byId[(int) $u['id']]['shop_name']   ?? null,
            'area'        => $byId[(int) $u['id']]['area']        ?? null,
            'pincode'     => $byId[(int) $u['id']]['pincode']     ?? null,
            'district_id' => $byId[(int) $u['id']]['district_id'] ?? null,
            'taluk_id'    => $byId[(int) $u['id']]['taluk_id']    ?? null,
            'state_id'    => $byId[(int) $u['id']]['state_id']    ?? null,
        ], $rows);

        return $this->ok(['items' => $items]);
    }
}
