<?php

namespace App\Controllers\Api;

use App\Models\TalukModel;
use App\Models\UserModel;
use App\Models\VendorProfileModel;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Manage vendors (the user accounts + their vendor_profiles).
 * Used by Vendor Manager (own vendors) and Admin (all).
 */
class VendorManagementController extends BaseApiController
{
    public function index(): ResponseInterface
    {
        if ($r = $this->requireRole(['vmanager', 'admin', 'taluk', 'district', 'state'])) return $r;
        $auth = $this->authUser();

        // Build the scope from the caller's geo position.
        // - taluk    → vendors in that taluk only
        // - district → vendors in any taluk under that district
        // - state    → vendors in any district under that state
        // - admin / vmanager → no geo scope (vmanager is further filtered below)
        $scopeTalukIds = null; // null = no geo restriction; [] = restrict but nothing matches
        if ($auth->role === 'taluk') {
            $myTaluk = (new \App\Models\TalukModel())->where('user_id', (int) $auth->id)->first();
            $scopeTalukIds = $myTaluk ? [(int) $myTaluk['id']] : [];
        } elseif ($auth->role === 'district') {
            $myDistrict = (new \App\Models\DistrictModel())->where('user_id', (int) $auth->id)->first();
            $scopeTalukIds = $myDistrict
                ? ((new \App\Models\TalukModel())->where('district_id', (int) $myDistrict['id'])->findColumn('id') ?: [])
                : [];
            $scopeTalukIds = array_map('intval', $scopeTalukIds);
        } elseif ($auth->role === 'state') {
            $myState = (new \App\Models\StateModel())->where('user_id', (int) $auth->id)->first();
            if (! $myState) {
                $scopeTalukIds = [];
            } else {
                $distIds = (new \App\Models\DistrictModel())->where('state_id', (int) $myState['id'])->findColumn('id') ?: [];
                $scopeTalukIds = $distIds
                    ? ((new \App\Models\TalukModel())->whereIn('district_id', $distIds)->findColumn('id') ?: [])
                    : [];
                $scopeTalukIds = array_map('intval', $scopeTalukIds);
            }
        }

        // When scope is restricted to specific taluks, pre-filter profiles.
        if (is_array($scopeTalukIds) && empty($scopeTalukIds)) {
            return $this->ok(['items' => []]); // role linked but no taluks in scope
        }
        $userIdsInScope = null;
        if (is_array($scopeTalukIds)) {
            $userIdsInScope = (new VendorProfileModel())->whereIn('taluk_id', $scopeTalukIds)->findColumn('user_id') ?: [];
            $userIdsInScope = array_map('intval', $userIdsInScope);
            if (empty($userIdsInScope)) return $this->ok(['items' => []]);
        }

        $userQuery = (new UserModel())->where('role', 'vendor');
        if ($userIdsInScope !== null) $userQuery->whereIn('id', $userIdsInScope);
        $users = $userQuery->orderBy('id', 'DESC')->findAll(500);

        $ids = array_map(static fn ($u) => (int) $u['id'], $users);
        $profiles = $ids ? (new VendorProfileModel())->whereIn('user_id', $ids)->findAll() : [];
        $profById = [];
        foreach ($profiles as $p) $profById[(int) $p['user_id']] = $p;

        $talukIds = array_values(array_unique(array_filter(array_map(
            static fn ($p) => (int) ($p['taluk_id'] ?? 0),
            $profiles
        ))));
        $taluks = $talukIds ? (new TalukModel())->whereIn('id', $talukIds)->findAll() : [];
        $talukNameById = [];
        foreach ($taluks as $t) $talukNameById[(int) $t['id']] = $t['name'];

        $items = [];
        foreach ($users as $u) {
            $p = $profById[(int) $u['id']] ?? null;
            // vmanager extra filter: only vendors managed by me
            if ($auth->role === 'vmanager' && (! $p || (int) ($p['vendor_manager_id'] ?? 0) !== (int) $auth->id)) continue;
            if ($p && ! empty($p['taluk_id'])) {
                $p['taluk_name'] = $talukNameById[(int) $p['taluk_id']] ?? null;
            }
            $items[] = [
                'id'            => (int) $u['id'],
                'name'          => $u['name'],
                'mobile_number' => $u['mobile_number'],
                'email'         => $u['email'],
                'status'        => $u['status'],
                'bank'          => [
                    'account_holder' => $u['account_holder'] ?? null,
                    'account_number' => $u['account_number'] ?? null,
                    'ifsc_code'      => $u['ifsc_code']      ?? null,
                    'bank_name'      => $u['bank_name']      ?? null,
                    'upi'            => $u['upi']            ?? null,
                ],
                'profile'       => $p,
            ];
        }
        return $this->ok(['items' => $items]);
    }

    /** Full profile for one vendor — shop, geo names, bank, KYC and lifetime counts. */
    public function show(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['vmanager', 'admin', 'taluk', 'district', 'state'])) return $r;
        $auth = $this->authUser();

        $u = (new UserModel())->find($id);
        if (! $u || $u['role'] !== 'vendor') return $this->fail('Vendor not found', 404);

        $p = (new VendorProfileModel())->find($id); // PK = user_id
        if ($auth->role === 'vmanager' && (! $p || (int) ($p['vendor_manager_id'] ?? 0) !== (int) $auth->id)) {
            return $this->fail('Forbidden', 403);
        }

        $stateName = $districtName = $talukName = $catName = null;
        if ($p) {
            if (! empty($p['state_id']))    { $s = (new \App\Models\StateModel())->find((int) $p['state_id']);    $stateName    = $s['name'] ?? null; }
            if (! empty($p['district_id'])) { $d = (new \App\Models\DistrictModel())->find((int) $p['district_id']); $districtName = $d['name'] ?? null; }
            if (! empty($p['taluk_id']))    { $t = (new TalukModel())->find((int) $p['taluk_id']);                 $talukName    = $t['name'] ?? null; }
            if (! empty($p['vendor_category_id'])) { $c = (new \App\Models\VendorCategoryModel())->find((int) $p['vendor_category_id']); $catName = $c['name'] ?? null; }
        }

        $db = db_connect();
        $products = (int) $db->query("SELECT COUNT(*) cnt FROM products WHERE vendor_id = ?", [$id])->getRow()->cnt;
        $orders   = $db->query(
            "SELECT COUNT(*) cnt, COALESCE(SUM(CASE WHEN status = 'delivered' THEN total ELSE 0 END), 0) sales
             FROM orders WHERE vendor_id = ?",
            [$id]
        )->getRow();

        return $this->ok([
            'id'             => (int) $u['id'],
            'name'           => $u['name'],
            'mobile_number'  => $u['mobile_number'],
            'email'          => $u['email'],
            'status'         => $u['status'],
            'created_at'     => $u['created_at'] ?? null,
            // shop
            'shop_name'      => $p['shop_name'] ?? null,
            'category_name'  => $catName,
            'commission_pct' => $p ? (float) ($p['commission_pct'] ?? 0) : null,
            'gst'            => $p['gst'] ?? null,
            // address
            'address'        => $p['address'] ?? null,
            'area'           => $p['area'] ?? null,
            'pincode'        => $p['pincode'] ?? ($u['pincode'] ?? null),
            'state_name'     => $stateName,
            'district_name'  => $districtName,
            'taluk_name'     => $talukName,
            // counts
            'products_count' => $products,
            'orders_count'   => (int) $orders->cnt,
            'total_sales'    => (float) $orders->sales,
            // bank
            'account_holder' => $u['account_holder'] ?? null,
            'bank_name'      => $u['bank_name'] ?? null,
            'account_number' => $u['account_number'] ?? null,
            'ifsc_code'      => $u['ifsc_code'] ?? null,
            'upi'            => $u['upi'] ?? null,
            // KYC documents (image values are raw paths / legacy URLs — the client
            // resolves them with fileUrl()).
            'aadhar'         => $u['aadhar'] ?? null,
            'aadhar_image'   => $u['aadhar_image'] ?? null,
            'pan'            => $u['pan'] ?? null,
            'pan_image'      => $u['pan_image'] ?? null,
            'bank_passbook'  => $u['bank_passbook'] ?? null,
            'kyc_status'     => $u['kyc_status'] ?? 'none',
            'kyc_note'       => $u['kyc_note'] ?? null,
        ]);
    }

    /** Create a vendor account + profile. */
    public function create(): ResponseInterface
    {
        if ($r = $this->requireRole(['vmanager', 'admin', 'taluk', 'district', 'state'])) return $r;
        $auth = $this->authUser();
        if (! $this->validate([
            'name'               => 'required|string|max_length[100]',
            'mobile_number'      => 'required|regex_match[/^[0-9]{10}$/]',
            'password'           => 'required|string|min_length[6]|max_length[64]',
            'shop_name'          => 'required|string|max_length[150]',
            'vendor_category_id' => 'required|is_natural_no_zero',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $users = new UserModel();
        if ($users->mobileExistsForRole($d['mobile_number'], 'vendor')) return $this->fail('Mobile already used for vendor', 409);

        $userId = $users->insert([
            'name'          => $d['name'],
            'mobile_number' => $d['mobile_number'],
            'email'         => $d['email'] ?? null,
            'password_hash' => password_hash($d['password'], PASSWORD_BCRYPT),
            'role'          => 'vendor',
            'status'        => 'active',
        ], true);

        // Stamp geo from the creator's own position so the vendor is scoped to the
        // taluk/district/state that onboarded it. The onboarding form doesn't ask for
        // a taluk — it's implied by who is logged in. Admin/vmanager have no geo of
        // their own, so they fall back to the request payload.
        $geoTalukId    = isset($d['taluk_id'])    ? (int) $d['taluk_id']    : null;
        $geoDistrictId = isset($d['district_id']) ? (int) $d['district_id'] : null;
        $geoStateId    = isset($d['state_id'])    ? (int) $d['state_id']    : null;
        if ($auth->role === 'taluk') {
            $myTaluk = (new TalukModel())->where('user_id', (int) $auth->id)->first();
            if ($myTaluk) {
                $geoTalukId    = (int) $myTaluk['id'];
                $geoDistrictId = (int) ($myTaluk['district_id'] ?? 0) ?: null;
                if ($geoDistrictId) {
                    $dist       = (new \App\Models\DistrictModel())->find($geoDistrictId);
                    $geoStateId = $dist ? ((int) ($dist['state_id'] ?? 0) ?: null) : null;
                }
            }
        } elseif ($auth->role === 'district') {
            $myDistrict = (new \App\Models\DistrictModel())->where('user_id', (int) $auth->id)->first();
            if ($myDistrict) {
                $geoDistrictId = (int) $myDistrict['id'];
                $geoStateId    = (int) ($myDistrict['state_id'] ?? 0) ?: null;
            }
        } elseif ($auth->role === 'state') {
            $myState = (new \App\Models\StateModel())->where('user_id', (int) $auth->id)->first();
            if ($myState) {
                $geoStateId = (int) $myState['id'];
            }
        }

        $profile = [
            'user_id'            => (int) $userId,
            'vendor_category_id' => (int) $d['vendor_category_id'],
            'commission_pct'     => isset($d['commission_pct']) ? (float) $d['commission_pct'] : 10.00,
            'shop_name'          => $d['shop_name'] ?? null,
            'address'            => $d['address'] ?? null,
            'area'               => $d['area'] ?? null,
            'state_id'           => $geoStateId,
            'district_id'        => $geoDistrictId,
            'taluk_id'           => $geoTalukId,
            'vendor_manager_id'  => $auth->role === 'vmanager' ? $auth->id : ($d['vendor_manager_id'] ?? null),
            'gst'                => $d['gst'] ?? null,
        ];
        (new VendorProfileModel())->insert($profile, false);
        return $this->ok(['id' => (int) $userId], 'Created');
    }

    public function update(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['vmanager', 'admin', 'taluk', 'district', 'state'])) return $r;
        $auth = $this->authUser();
        $users = new UserModel();
        $u = $users->find($id);
        if (! $u || $u['role'] !== 'vendor') return $this->fail('Vendor not found', 404);

        $profModel = new VendorProfileModel();
        $existing = $profModel->find($id);
        if ($auth->role === 'vmanager' && (! $existing || (int) ($existing['vendor_manager_id'] ?? 0) !== (int) $auth->id)) {
            return $this->fail('Forbidden', 403);
        }

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $userPayload = array_intersect_key($d, array_flip(['name', 'email', 'status']));
        if ($userPayload) $users->update($id, $userPayload);

        $profileFields = ['shop_name', 'address', 'area', 'district_id', 'taluk_id', 'gst', 'vendor_category_id', 'commission_pct'];
        if ($auth->role === 'admin') $profileFields[] = 'vendor_manager_id';
        $profilePayload = array_intersect_key($d, array_flip($profileFields));
        if ($profilePayload) {
            if ($existing) $profModel->update($id, $profilePayload);
            else $profModel->insert(['user_id' => $id] + $profilePayload, false);
        }
        return $this->ok(null, 'Updated');
    }

    public function resetPassword(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['vmanager', 'admin', 'taluk', 'district', 'state'])) return $r;
        if (! $this->validate([
            'password' => 'required|string|min_length[6]|max_length[64]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $users = new UserModel();
        $u = $users->find($id);
        if (! $u || $u['role'] !== 'vendor') return $this->fail('Vendor not found', 404);

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $users->update($id, ['password_hash' => password_hash($d['password'], PASSWORD_BCRYPT)]);
        return $this->ok(null, 'Password updated');
    }

    public function block(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin', 'vmanager', 'taluk', 'district', 'state'])) return $r;
        // Target must actually be a vendor — without this a staff user could pass
        // any user id and block an admin / another staff / a customer (IDOR + DoS).
        $u = (new UserModel())->find($id);
        if (! $u || ($u['role'] ?? '') !== 'vendor') return $this->fail('Vendor not found', 404);
        (new UserModel())->update($id, ['status' => 'blocked']);
        return $this->ok(null, 'Blocked');
    }

    public function unblock(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin', 'vmanager', 'taluk', 'district', 'state'])) return $r;
        $u = (new UserModel())->find($id);
        if (! $u || ($u['role'] ?? '') !== 'vendor') return $this->fail('Vendor not found', 404);
        (new UserModel())->update($id, ['status' => 'active']);
        return $this->ok(null, 'Unblocked');
    }

    private function requireRole(array $roles): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, $roles, true)) return $this->fail('Forbidden', 403);
        return null;
    }
}
