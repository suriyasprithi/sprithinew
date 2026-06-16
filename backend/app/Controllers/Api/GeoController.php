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
            'mobile_number' => 'required|regex_match[/^[0-9]{10}$/]',
            'password'      => 'required|string|min_length[6]|max_length[64]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        if ($this->stateNameExists($d['name'])) {
            return $this->fail('A state with this name already exists', 409);
        }
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

        if (isset($d['name']) && $this->stateNameExists($d['name'], $id)) {
            return $this->fail('A state with this name already exists', 409);
        }

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
        $auth = $this->authUser();
        $stateId = (int) $this->request->getGet('state_id');

        // Auto-scope: a state-role user can only see their own state's
        // districts (their states.user_id points to themselves).
        if (! $stateId && $auth && $auth->role === 'state') {
            $myState = (new StateModel())->where('user_id', $auth->id)->first();
            if ($myState) $stateId = (int) $myState['id'];
            else return $this->ok(['items' => []]);
        }

        $model = new DistrictModel();
        if ($stateId) $model->where('state_id', $stateId);
        $rows = $model->orderBy('name', 'ASC')->findAll();
        return $this->ok(['items' => $this->attachUserInfo($rows, 'district')]);
    }

    public function createDistrict(): ResponseInterface
    {
        if ($r = $this->requireRole(['admin', 'state'])) return $r;
        if (! $this->validate([
            'name'          => 'required|string|max_length[100]',
            'mobile_number' => 'required|regex_match[/^[0-9]{10}$/]',
            'password'      => 'required|string|min_length[6]|max_length[64]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $stateId = isset($d['state_id']) ? (int) $d['state_id'] : null;

        // State-role user can only create districts within their own state.
        // Force the state_id to their own state regardless of what the frontend sent.
        $auth = $this->authUser();
        if ($auth && $auth->role === 'state') {
            $myState = (new StateModel())->where('user_id', (int) $auth->id)->first();
            if (! $myState) return $this->fail('No state linked to your account', 403);
            $stateId = (int) $myState['id'];
        }

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
            'state_id' => $stateId,
            'user_id'  => $userId,
            'status'   => $d['status'] ?? 'active',
        ], true);
        return $this->ok(['id' => (int) $id], 'Created');
    }

    public function updateDistrict(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin', 'state'])) return $r;
        $d = $this->request->getJSON(true) ?? $this->request->getPost();

        $districts = new DistrictModel();
        $row = $districts->find($id);
        if (! $row) return $this->fail('District not found', 404);

        // State user can only modify districts in their own state.
        $auth = $this->authUser();
        if ($auth && $auth->role === 'state') {
            $myState = (new StateModel())->where('user_id', (int) $auth->id)->first();
            if (! $myState || (int) $row['state_id'] !== (int) $myState['id']) {
                return $this->fail('District not in your state', 403);
            }
            // Block state_id changes that would move it out of their state.
            if (isset($d['state_id'])) $d['state_id'] = (int) $myState['id'];
        }

        $payload = array_intersect_key($d, array_flip(['name', 'state_id', 'status']));
        if ($payload) $districts->update($id, $payload);

        $this->syncPairedUser($row['user_id'] ?? null, $d, 'district');

        return $this->ok(null, 'Updated');
    }

    public function deleteDistrict(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin', 'state'])) return $r;
        $row = (new DistrictModel())->find($id);
        if (! $row) return $this->fail('District not found', 404);
        $auth = $this->authUser();
        if ($auth && $auth->role === 'state') {
            $myState = (new StateModel())->where('user_id', (int) $auth->id)->first();
            if (! $myState || (int) $row['state_id'] !== (int) $myState['id']) {
                return $this->fail('District not in your state', 403);
            }
        }
        (new DistrictModel())->delete($id);
        return $this->ok(null, 'Deleted');
    }

    public function resetDistrictPassword(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin', 'state'])) return $r;
        $row = (new DistrictModel())->find($id);
        if (! $row) return $this->fail('District not found', 404);
        $auth = $this->authUser();
        if ($auth && $auth->role === 'state') {
            $myState = (new StateModel())->where('user_id', (int) $auth->id)->first();
            if (! $myState || (int) $row['state_id'] !== (int) $myState['id']) {
                return $this->fail('District not in your state', 403);
            }
        }
        return $this->resetGeoPassword(new DistrictModel(), $id);
    }

    public function taluks(): ResponseInterface
    {
        $auth = $this->authUser();
        $districtId = (int) $this->request->getGet('district_id');
        $model = new TalukModel();

        // Auto-scope:
        // - district-role user → only taluks in their own district
        // - state-role user (no explicit district_id) → taluks across all
        //   districts in their state
        if (! $districtId && $auth && $auth->role === 'district') {
            $myDistrict = (new DistrictModel())->where('user_id', $auth->id)->first();
            if ($myDistrict) $districtId = (int) $myDistrict['id'];
            else return $this->ok(['items' => []]);
        }
        if (! $districtId && $auth && $auth->role === 'state') {
            $myState = (new StateModel())->where('user_id', $auth->id)->first();
            if (! $myState) return $this->ok(['items' => []]);
            $distIds = (new DistrictModel())->where('state_id', (int) $myState['id'])->findColumn('id') ?: [];
            if (! $distIds) return $this->ok(['items' => []]);
            $model->whereIn('district_id', $distIds);
        } elseif ($districtId) {
            $model->where('district_id', $districtId);
        }

        $rows = $model->orderBy('name', 'ASC')->findAll();
        return $this->ok(['items' => $this->attachUserInfo($rows, 'taluk')]);
    }

    public function createTaluk(): ResponseInterface
    {
        if ($r = $this->requireRole(['admin', 'state', 'district'])) return $r;
        if (! $this->validate([
            'district_id'   => 'required|integer',
            'name'          => 'required|string|max_length[100]',
            'mobile_number' => 'required|regex_match[/^[0-9]{10}$/]',
            'password'      => 'required|string|min_length[6]|max_length[64]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $districtId = (int) $d['district_id'];

        // Scope to caller's territory.
        $auth = $this->authUser();
        if ($auth && $auth->role === 'district') {
            $myDistrict = (new DistrictModel())->where('user_id', (int) $auth->id)->first();
            if (! $myDistrict) return $this->fail('No district linked to your account', 403);
            $districtId = (int) $myDistrict['id'];
        } elseif ($auth && $auth->role === 'state') {
            $myState = (new StateModel())->where('user_id', (int) $auth->id)->first();
            if (! $myState) return $this->fail('No state linked to your account', 403);
            $district = (new DistrictModel())->find($districtId);
            if (! $district || (int) $district['state_id'] !== (int) $myState['id']) {
                return $this->fail('District not in your state', 403);
            }
        }

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
            'district_id' => $districtId,
            'name'        => $d['name'],
            'user_id'     => $userId,
            'status'      => $d['status'] ?? 'active',
        ], true);
        return $this->ok(['id' => (int) $id], 'Created');
    }

    public function updateTaluk(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin', 'state', 'district'])) return $r;
        $d = $this->request->getJSON(true) ?? $this->request->getPost();

        $taluks = new TalukModel();
        $row = $taluks->find($id);
        if (! $row) return $this->fail('Taluk not found', 404);

        $auth = $this->authUser();
        if ($auth && $auth->role === 'district') {
            $myDistrict = (new DistrictModel())->where('user_id', (int) $auth->id)->first();
            if (! $myDistrict || (int) $row['district_id'] !== (int) $myDistrict['id']) {
                return $this->fail('Taluk not in your district', 403);
            }
            if (isset($d['district_id'])) $d['district_id'] = (int) $myDistrict['id'];
        } elseif ($auth && $auth->role === 'state') {
            $myState = (new StateModel())->where('user_id', (int) $auth->id)->first();
            $district = (new DistrictModel())->find((int) $row['district_id']);
            if (! $myState || ! $district || (int) $district['state_id'] !== (int) $myState['id']) {
                return $this->fail('Taluk not in your state', 403);
            }
        }

        $payload = array_intersect_key($d, array_flip(['district_id', 'name', 'status']));
        if ($payload) $taluks->update($id, $payload);

        $this->syncPairedUser($row['user_id'] ?? null, $d, 'taluk');

        return $this->ok(null, 'Updated');
    }

    public function deleteTaluk(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin', 'state', 'district'])) return $r;
        $row = (new TalukModel())->find($id);
        if (! $row) return $this->fail('Taluk not found', 404);
        if ($r = $this->checkTalukScope($row)) return $r;
        (new TalukModel())->delete($id);
        return $this->ok(null, 'Deleted');
    }

    public function resetTalukPassword(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin', 'state', 'district'])) return $r;
        $row = (new TalukModel())->find($id);
        if (! $row) return $this->fail('Taluk not found', 404);
        if ($r = $this->checkTalukScope($row)) return $r;
        return $this->resetGeoPassword(new TalukModel(), $id);
    }

    /** Ensure current state/district user can act on the given taluk row. */
    private function checkTalukScope(array $row): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth || $auth->role === 'admin') return null;
        if ($auth->role === 'district') {
            $myDistrict = (new DistrictModel())->where('user_id', (int) $auth->id)->first();
            if (! $myDistrict || (int) $row['district_id'] !== (int) $myDistrict['id']) {
                return $this->fail('Taluk not in your district', 403);
            }
        } elseif ($auth->role === 'state') {
            $myState = (new StateModel())->where('user_id', (int) $auth->id)->first();
            $district = (new DistrictModel())->find((int) $row['district_id']);
            if (! $myState || ! $district || (int) $district['state_id'] !== (int) $myState['id']) {
                return $this->fail('Taluk not in your state', 403);
            }
        }
        return null;
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

    /**
     * True if another state already has this name, compared case- and
     * whitespace-insensitively ("Tamil nadu" == "tamilnadu" == "  TAMILNADU ").
     * Pass $excludeId when renaming so a state doesn't clash with itself.
     */
    private function stateNameExists(string $name, ?int $excludeId = null): bool
    {
        $norm   = static fn ($s) => preg_replace('/\s+/u', '', mb_strtolower(trim((string) $s)));
        $target = $norm($name);
        if ($target === '') return false;
        foreach ((new StateModel())->findAll() as $row) {
            if ($excludeId !== null && (int) $row['id'] === $excludeId) continue;
            if ($norm($row['name'] ?? '') === $target) return true;
        }
        return false;
    }

    private function requireRole(array $roles): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, $roles, true)) return $this->fail('Forbidden', 403);
        return null;
    }
}
