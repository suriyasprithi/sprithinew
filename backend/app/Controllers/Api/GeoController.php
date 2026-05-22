<?php

namespace App\Controllers\Api;

use App\Models\DistrictModel;
use App\Models\StateModel;
use App\Models\TalukModel;
use App\Models\UserModel;
use CodeIgniter\HTTP\ResponseInterface;

class GeoController extends BaseApiController
{
    public function states(): ResponseInterface
    {
        $rows = (new StateModel())->orderBy('name', 'ASC')->findAll();
        return $this->ok(['items' => $this->attachUserInfo($rows, 'state')]);
    }

    public function createState(): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        if (! $this->validate([
            'name'          => 'required|string|max_length[100]',
            'mobile_number' => 'required|string|min_length[7]|max_length[15]',
            'password'      => 'required|string|min_length[6]|max_length[64]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $users = new UserModel();
        if ($users->mobileExistsForRole($d['mobile_number'], 'state')) {
            return $this->fail('Mobile already used for state', 409);
        }

        $userId = (int) $users->insert([
            'name'          => $d['name'],
            'mobile_number' => $d['mobile_number'],
            'password_hash' => password_hash($d['password'], PASSWORD_BCRYPT),
            'role'          => 'state',
            'status'        => 'active',
        ], true);

        $id = (new StateModel())->insert([
            'name'    => $d['name'],
            'user_id' => $userId,
            'status'  => $d['status'] ?? 'active',
        ], true);
        return $this->ok(['id' => (int) $id], 'Created');
    }

    public function updateState(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        $d = $this->request->getJSON(true) ?? $this->request->getPost();

        $states = new StateModel();
        $row = $states->find($id);
        if (! $row) return $this->fail('State not found', 404);

        $payload = array_intersect_key($d, array_flip(['name', 'status']));
        if ($payload) $states->update($id, $payload);

        $this->syncPairedUser($row['user_id'] ?? null, $d, 'state');

        return $this->ok(null, 'Updated');
    }

    public function deleteState(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        (new StateModel())->delete($id);
        return $this->ok(null, 'Deleted');
    }

    public function resetStatePassword(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        return $this->resetGeoPassword(new StateModel(), $id);
    }

    public function districts(): ResponseInterface
    {
        $stateId = (int) $this->request->getGet('state_id');
        $model = new DistrictModel();
        if ($stateId) $model->where('state_id', $stateId);
        $rows = $model->orderBy('name', 'ASC')->findAll();
        return $this->ok(['items' => $this->attachUserInfo($rows, 'district')]);
    }

    public function createDistrict(): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        if (! $this->validate([
            'name'          => 'required|string|max_length[100]',
            'mobile_number' => 'required|string|min_length[7]|max_length[15]',
            'password'      => 'required|string|min_length[6]|max_length[64]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $users = new UserModel();
        if ($users->mobileExistsForRole($d['mobile_number'], 'district')) {
            return $this->fail('Mobile already used for district', 409);
        }

        $userId = (int) $users->insert([
            'name'          => $d['name'],
            'mobile_number' => $d['mobile_number'],
            'password_hash' => password_hash($d['password'], PASSWORD_BCRYPT),
            'role'          => 'district',
            'status'        => 'active',
        ], true);

        $id = (new DistrictModel())->insert([
            'name'     => $d['name'],
            'state_id' => isset($d['state_id']) ? (int) $d['state_id'] : null,
            'user_id'  => $userId,
            'status'   => $d['status'] ?? 'active',
        ], true);
        return $this->ok(['id' => (int) $id], 'Created');
    }

    public function updateDistrict(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        $d = $this->request->getJSON(true) ?? $this->request->getPost();

        $districts = new DistrictModel();
        $row = $districts->find($id);
        if (! $row) return $this->fail('District not found', 404);

        $payload = array_intersect_key($d, array_flip(['name', 'state_id', 'status']));
        if ($payload) $districts->update($id, $payload);

        $this->syncPairedUser($row['user_id'] ?? null, $d, 'district');

        return $this->ok(null, 'Updated');
    }

    public function deleteDistrict(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        (new DistrictModel())->delete($id);
        return $this->ok(null, 'Deleted');
    }

    public function resetDistrictPassword(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        return $this->resetGeoPassword(new DistrictModel(), $id);
    }

    public function taluks(): ResponseInterface
    {
        $districtId = (int) $this->request->getGet('district_id');
        $model = new TalukModel();
        if ($districtId) $model->where('district_id', $districtId);
        $rows = $model->orderBy('name', 'ASC')->findAll();
        return $this->ok(['items' => $this->attachUserInfo($rows, 'taluk')]);
    }

    public function createTaluk(): ResponseInterface
    {
        if ($r = $this->requireRole(['admin', 'taluk'])) return $r;
        if (! $this->validate([
            'district_id'   => 'required|integer',
            'name'          => 'required|string|max_length[100]',
            'mobile_number' => 'required|string|min_length[7]|max_length[15]',
            'password'      => 'required|string|min_length[6]|max_length[64]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $users = new UserModel();
        if ($users->mobileExistsForRole($d['mobile_number'], 'taluk')) {
            return $this->fail('Mobile already used for taluk', 409);
        }

        $userId = (int) $users->insert([
            'name'          => $d['name'],
            'mobile_number' => $d['mobile_number'],
            'password_hash' => password_hash($d['password'], PASSWORD_BCRYPT),
            'role'          => 'taluk',
            'status'        => 'active',
        ], true);

        $id = (new TalukModel())->insert([
            'district_id' => (int) $d['district_id'],
            'name'        => $d['name'],
            'user_id'     => $userId,
            'status'      => $d['status'] ?? 'active',
        ], true);
        return $this->ok(['id' => (int) $id], 'Created');
    }

    public function updateTaluk(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin', 'taluk'])) return $r;
        $d = $this->request->getJSON(true) ?? $this->request->getPost();

        $taluks = new TalukModel();
        $row = $taluks->find($id);
        if (! $row) return $this->fail('Taluk not found', 404);

        $payload = array_intersect_key($d, array_flip(['district_id', 'name', 'status']));
        if ($payload) $taluks->update($id, $payload);

        $this->syncPairedUser($row['user_id'] ?? null, $d, 'taluk');

        return $this->ok(null, 'Updated');
    }

    public function deleteTaluk(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin', 'taluk'])) return $r;
        (new TalukModel())->delete($id);
        return $this->ok(null, 'Deleted');
    }

    public function resetTalukPassword(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin', 'taluk'])) return $r;
        return $this->resetGeoPassword(new TalukModel(), $id);
    }

    /**
     * Attach mobile_number from the paired user (role-scoped) to each geo row.
     * Frontend uses this to display the login mobile next to the geo entity.
     */
    private function attachUserInfo(array $rows, string $role): array
    {
        $ids = array_values(array_filter(array_map(static fn ($r) => (int) ($r['user_id'] ?? 0), $rows)));
        if (! $ids) return $rows;
        $users = (new UserModel())->whereIn('id', $ids)->where('role', $role)->findAll();
        $byId = [];
        foreach ($users as $u) $byId[(int) $u['id']] = $u;
        foreach ($rows as &$r) {
            $u = $byId[(int) ($r['user_id'] ?? 0)] ?? null;
            $r['mobile_number'] = $u['mobile_number'] ?? null;
        }
        return $rows;
    }

    /** Sync paired user when geo entity is updated (name and optional password). */
    private function syncPairedUser($userId, array $d, string $role): void
    {
        $userId = (int) ($userId ?? 0);
        if (! $userId) return;
        $users = new UserModel();
        $u = $users->find($userId);
        if (! $u || $u['role'] !== $role) return;

        $update = [];
        if (! empty($d['name']))          $update['name']          = $d['name'];
        if (! empty($d['mobile_number']) && $d['mobile_number'] !== $u['mobile_number']) {
            if (! $users->mobileExistsForRole($d['mobile_number'], $role)) {
                $update['mobile_number'] = $d['mobile_number'];
            }
        }
        if (! empty($d['password'])) {
            $update['password_hash'] = password_hash($d['password'], PASSWORD_BCRYPT);
        }
        if ($update) $users->update($userId, $update);
    }

    /** Reset the paired user's password for a given geo row. */
    private function resetGeoPassword($model, int $id): ResponseInterface
    {
        if (! $this->validate(['password' => 'required|string|min_length[6]|max_length[64]'])) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }
        $row = $model->find($id);
        if (! $row) return $this->fail('Not found', 404);
        $userId = (int) ($row['user_id'] ?? 0);
        if (! $userId) return $this->fail('No paired login account', 422);

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        (new UserModel())->update($userId, [
            'password_hash' => password_hash($d['password'], PASSWORD_BCRYPT),
        ]);
        return $this->ok(null, 'Password updated');
    }

    private function requireRole(array $roles): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, $roles, true)) return $this->fail('Forbidden', 403);
        return null;
    }
}
