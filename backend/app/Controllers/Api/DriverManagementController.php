<?php

namespace App\Controllers\Api;

use App\Models\TalukModel;
use App\Models\UserModel;
use CodeIgniter\HTTP\ResponseInterface;

class DriverManagementController extends BaseApiController
{
    public function index(): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        $rows = (new UserModel())->where('role', 'driver')->orderBy('id', 'DESC')->findAll(500);
        return $this->ok(['items' => $this->decorate($rows)]);
    }

    /** Drivers in the current taluk-user's taluk. */
    public function talukIndex(): ResponseInterface
    {
        if ($r = $this->requireRole(['taluk'])) return $r;
        $auth = $this->authUser();
        $taluk = (new TalukModel())->where('user_id', (int) $auth->id)->first();
        if (! $taluk) return $this->ok(['items' => []]);

        $rows = (new UserModel())
            ->where('role', 'driver')
            ->where('taluk_id', (int) $taluk['id'])
            ->orderBy('id', 'DESC')
            ->findAll(500);
        return $this->ok(['items' => $this->decorate($rows), 'taluk_id' => (int) $taluk['id']]);
    }

    public function create(): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        if (! $this->validate([
            'name'           => 'required|string|max_length[100]',
            'mobile_number'  => 'required|string|min_length[7]|max_length[15]',
            'password'       => 'required|string|min_length[6]|max_length[64]',
            'vehicle_number' => 'permit_empty|string|max_length[20]',
            'license_number' => 'permit_empty|string|max_length[50]',
            'monthly_salary' => 'permit_empty|numeric',
            'km_rate'        => 'permit_empty|numeric',
            'hour_rate'      => 'permit_empty|numeric',
            'taluk_id'       => 'permit_empty|is_natural_no_zero',
            'id_card_url'    => 'permit_empty|string',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $users = new UserModel();
        if ($users->mobileExistsForRole($d['mobile_number'], 'driver')) {
            return $this->fail('Mobile already used for a driver', 409);
        }

        $id = $users->insert([
            'name'           => trim($d['name']),
            'mobile_number'  => trim($d['mobile_number']),
            'password_hash'  => password_hash($d['password'], PASSWORD_BCRYPT),
            'role'           => 'driver',
            'status'         => 'active',
            'vehicle_number' => $d['vehicle_number'] ?? null,
            'license_number' => $d['license_number'] ?? null,
            'monthly_salary' => isset($d['monthly_salary']) ? (float) $d['monthly_salary'] : 0,
            'km_rate'        => isset($d['km_rate']) ? (float) $d['km_rate'] : 0,
            'hour_rate'      => isset($d['hour_rate']) ? (float) $d['hour_rate'] : 0,
            'taluk_id'       => isset($d['taluk_id']) ? (int) $d['taluk_id'] : null,
            'id_card_url'    => $d['id_card_url'] ?? null,
        ], true);

        return $this->ok(['id' => (int) $id], 'Created');
    }

    public function update(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        $users = new UserModel();
        $u = $users->find($id);
        if (! $u || $u['role'] !== 'driver') return $this->fail('Driver not found', 404);

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $payload = array_intersect_key($d, array_flip([
            'name', 'vehicle_number', 'license_number', 'id_card_url',
            'monthly_salary', 'km_rate', 'hour_rate',
            'taluk_id', 'status',
        ]));
        foreach (['monthly_salary', 'km_rate', 'hour_rate'] as $k) {
            if (isset($payload[$k])) $payload[$k] = (float) $payload[$k];
        }
        if (array_key_exists('taluk_id', $payload)) {
            $payload['taluk_id'] = $payload['taluk_id'] ? (int) $payload['taluk_id'] : null;
            $payload['assigned_vendor_id'] = null;
        }
        if ($payload) $users->update($id, $payload);
        return $this->ok(null, 'Updated');
    }

    /** Taluk user assigns this driver to a vendor in their taluk. */
    public function assignVendor(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['taluk', 'admin'])) return $r;
        if (! $this->validate(['vendor_id' => 'permit_empty|is_natural'])) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }

        $users = new UserModel();
        $driver = $users->find($id);
        if (! $driver || $driver['role'] !== 'driver') return $this->fail('Driver not found', 404);

        $auth = $this->authUser();
        if ($auth->role === 'taluk') {
            $taluk = (new TalukModel())->where('user_id', (int) $auth->id)->first();
            if (! $taluk || (int) $driver['taluk_id'] !== (int) $taluk['id']) {
                return $this->fail('Driver not in your taluk', 403);
            }
        }

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $vendorId = (isset($d['vendor_id']) && $d['vendor_id']) ? (int) $d['vendor_id'] : null;
        if ($vendorId) {
            $vendor = $users->find($vendorId);
            if (! $vendor || $vendor['role'] !== 'vendor') return $this->fail('Vendor not found', 404);
        }
        $users->update($id, ['assigned_vendor_id' => $vendorId]);
        return $this->ok(null, $vendorId ? 'Assigned' : 'Unassigned');
    }

    public function block(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        $users = new UserModel();
        $u = $users->find($id);
        if (! $u || $u['role'] !== 'driver') return $this->fail('Driver not found', 404);
        $users->update($id, ['status' => 'blocked']);
        return $this->ok(null, 'Blocked');
    }

    public function unblock(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        $users = new UserModel();
        $u = $users->find($id);
        if (! $u || $u['role'] !== 'driver') return $this->fail('Driver not found', 404);
        $users->update($id, ['status' => 'active']);
        return $this->ok(null, 'Unblocked');
    }

    public function resetPassword(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        if (! $this->validate(['password' => 'required|string|min_length[6]|max_length[64]'])) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }
        $users = new UserModel();
        $u = $users->find($id);
        if (! $u || $u['role'] !== 'driver') return $this->fail('Driver not found', 404);
        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $users->update($id, ['password_hash' => password_hash($d['password'], PASSWORD_BCRYPT)]);
        return $this->ok(null, 'Password updated');
    }

    private function requireRole(array $roles): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, $roles, true)) return $this->fail('Forbidden', 403);
        return null;
    }

    /** Attach taluk name + vendor name for the row. */
    private function decorate(array $rows): array
    {
        if (! $rows) return [];
        $talukIds  = array_values(array_unique(array_filter(array_map(static fn ($r) => (int) ($r['taluk_id'] ?? 0), $rows))));
        $vendorIds = array_values(array_unique(array_filter(array_map(static fn ($r) => (int) ($r['assigned_vendor_id'] ?? 0), $rows))));

        $talukNameById = [];
        if ($talukIds) {
            foreach ((new TalukModel())->whereIn('id', $talukIds)->findAll() as $t) {
                $talukNameById[(int) $t['id']] = $t['name'];
            }
        }
        $vendorNameById = [];
        if ($vendorIds) {
            foreach ((new UserModel())->whereIn('id', $vendorIds)->findAll() as $v) {
                $vendorNameById[(int) $v['id']] = $v['name'];
            }
        }

        $out = [];
        foreach ($rows as $u) {
            $out[] = [
                'id'                 => (int) $u['id'],
                'name'               => $u['name'],
                'mobile_number'      => $u['mobile_number'],
                'vehicle_number'     => $u['vehicle_number'] ?? null,
                'license_number'     => $u['license_number'] ?? null,
                'id_card_url'        => $u['id_card_url'] ?? null,
                'monthly_salary'     => (float) ($u['monthly_salary'] ?? 0),
                'km_rate'            => (float) ($u['km_rate'] ?? 0),
                'hour_rate'          => (float) ($u['hour_rate'] ?? 0),
                'taluk_id'           => $u['taluk_id'] ? (int) $u['taluk_id'] : null,
                'taluk_name'         => $u['taluk_id'] ? ($talukNameById[(int) $u['taluk_id']] ?? null) : null,
                'assigned_vendor_id' => $u['assigned_vendor_id'] ? (int) $u['assigned_vendor_id'] : null,
                'assigned_vendor_name' => $u['assigned_vendor_id'] ? ($vendorNameById[(int) $u['assigned_vendor_id']] ?? null) : null,
                'status'             => $u['status'],
            ];
        }
        return $out;
    }
}
