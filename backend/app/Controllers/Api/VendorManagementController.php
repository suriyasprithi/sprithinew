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

        $users = (new UserModel())->where('role', 'vendor')->orderBy('id', 'DESC')->findAll(500);
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
            // If vmanager, only show vendors managed by me
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
                'profile'       => $p,
            ];
        }
        return $this->ok(['items' => $items]);
    }

    /** Create a vendor account + profile. */
    public function create(): ResponseInterface
    {
        if ($r = $this->requireRole(['vmanager', 'admin', 'taluk', 'district', 'state'])) return $r;
        $auth = $this->authUser();
        if (! $this->validate([
            'name'               => 'required|string|max_length[100]',
            'mobile_number'      => 'required|string|min_length[7]|max_length[15]',
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

        $profile = [
            'user_id'            => (int) $userId,
            'vendor_category_id' => (int) $d['vendor_category_id'],
            'commission_pct'     => isset($d['commission_pct']) ? (float) $d['commission_pct'] : 10.00,
            'shop_name'          => $d['shop_name'] ?? null,
            'address'            => $d['address'] ?? null,
            'area'               => $d['area'] ?? null,
            'district_id'        => $d['district_id'] ?? null,
            'taluk_id'           => $d['taluk_id'] ?? null,
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
        (new UserModel())->update($id, ['status' => 'blocked']);
        return $this->ok(null, 'Blocked');
    }

    public function unblock(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin', 'vmanager', 'taluk', 'district', 'state'])) return $r;
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
