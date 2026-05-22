<?php

namespace App\Controllers;

use App\Models\CategoryModel;
use App\Models\ProductModel;
use App\Models\UserModel;
use App\Models\VendorProfileModel;

class Home extends BaseController
{
    public function index(): string
    {
        $productModel = new ProductModel();
        $catModel     = new CategoryModel();
        $vendorModel  = new VendorProfileModel();
        $userModel    = new UserModel();

        $products = $productModel
            ->where('status', 'active')
            ->orderBy('id', 'DESC')
            ->findAll(12);

        // Decode attributes JSON for each product so the view can show them.
        foreach ($products as &$p) {
            $raw = $p['attributes'] ?? null;
            $p['attributes'] = is_string($raw) ? (json_decode($raw, true) ?: null) : (is_array($raw) ? $raw : null);
            $p['price']      = (float) ($p['price'] ?? 0);
        }
        unset($p);

        // Attach vendor names.
        $vendorIds = array_unique(array_filter(array_map(static fn ($r) => (int) ($r['vendor_id'] ?? 0), $products)));
        $vendorProfiles = $vendorIds ? $vendorModel->whereIn('user_id', $vendorIds)->findAll() : [];
        $vendorUsers    = $vendorIds ? $userModel->whereIn('id', $vendorIds)->findAll() : [];
        $shopName = []; foreach ($vendorProfiles as $vp) $shopName[(int) $vp['user_id']] = $vp['shop_name'];
        $userName = []; foreach ($vendorUsers    as $u)  $userName[(int) $u['id']]      = $u['name'];
        foreach ($products as &$p) {
            $vid = (int) ($p['vendor_id'] ?? 0);
            $p['vendor_name'] = $shopName[$vid] ?? $userName[$vid] ?? null;
        }
        unset($p);

        $categories = $catModel
            ->where('status', 'active')
            ->orderBy('name', 'ASC')
            ->findAll(12);

        // A few vendor cards — use users with role=vendor + status=active.
        $vendors = $userModel
            ->where('role', 'vendor')
            ->where('status', 'active')
            ->orderBy('id', 'DESC')
            ->findAll(6);
        $vendorIdsForCards = array_map(static fn ($v) => (int) $v['id'], $vendors);
        $vendorProfilesForCards = $vendorIdsForCards ? $vendorModel->whereIn('user_id', $vendorIdsForCards)->findAll() : [];
        $profileByUser = []; foreach ($vendorProfilesForCards as $p) $profileByUser[(int) $p['user_id']] = $p;
        foreach ($vendors as &$v) {
            $vp = $profileByUser[(int) $v['id']] ?? null;
            $v['shop_name'] = $vp['shop_name'] ?? $v['name'];
            $v['area']      = $vp['area']      ?? null;
            $v['pincode']   = $vp['pincode']   ?? null;
        }
        unset($v);

        return view('landing', [
            'products'   => $products,
            'categories' => $categories,
            'vendors'    => $vendors,
            'stats'      => [
                'products' => $productModel->where('status', 'active')->countAllResults(),
                'vendors'  => $userModel->where('role', 'vendor')->where('status', 'active')->countAllResults(),
                'categories' => $catModel->where('status', 'active')->countAllResults(),
            ],
        ]);
    }
}
