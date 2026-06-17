<?php

namespace App\Controllers\Api;

use App\Models\DriverShiftModel;
use CodeIgniter\HTTP\ResponseInterface;

class DriverShiftController extends BaseApiController
{
    public function index(): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        $rows = (new DriverShiftModel())->orderBy('id', 'DESC')->findAll(500);
        return $this->ok(['items' => array_map([$this, 'row'], $rows)]);
    }

    public function create(): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        if (! $this->validate([
            'name'       => 'required|string|max_length[50]',
            'start_time' => 'permit_empty|regex_match[/^[0-2][0-9]:[0-5][0-9]/]',
            'end_time'   => 'permit_empty|regex_match[/^[0-2][0-9]:[0-5][0-9]/]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d  = $this->request->getJSON(true) ?? $this->request->getPost();
        $id = (new DriverShiftModel())->insert([
            'name'       => trim($d['name']),
            'start_time' => ! empty($d['start_time']) ? $d['start_time'] : null,
            'end_time'   => ! empty($d['end_time']) ? $d['end_time'] : null,
            'is_active'  => isset($d['is_active']) ? (int) (bool) $d['is_active'] : 1,
        ], true);
        return $this->ok(['id' => (int) $id], 'Created');
    }

    public function update(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        $model = new DriverShiftModel();
        if (! $model->find($id)) return $this->fail('Not found', 404);

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $payload = array_intersect_key($d, array_flip(['name', 'start_time', 'end_time', 'is_active']));
        if (isset($payload['name']))       $payload['name'] = trim($payload['name']);
        if (array_key_exists('start_time', $payload)) $payload['start_time'] = ! empty($payload['start_time']) ? $payload['start_time'] : null;
        if (array_key_exists('end_time', $payload))   $payload['end_time']   = ! empty($payload['end_time']) ? $payload['end_time'] : null;
        if (isset($payload['is_active']))  $payload['is_active'] = (int) (bool) $payload['is_active'];
        if ($payload) $model->update($id, $payload);
        return $this->ok(null, 'Updated');
    }

    public function delete(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        (new DriverShiftModel())->delete($id);
        return $this->ok(null, 'Deleted');
    }

    private function requireRole(array $roles): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, $roles, true)) return $this->fail('Forbidden', 403);
        return null;
    }

    /** Normalise one row: trim TIME seconds to HH:MM, cast is_active. */
    private function row(array $r): array
    {
        return [
            'id'         => (int) $r['id'],
            'name'       => $r['name'],
            'start_time' => $r['start_time'] ? substr($r['start_time'], 0, 5) : null,
            'end_time'   => $r['end_time'] ? substr($r['end_time'], 0, 5) : null,
            'is_active'  => (int) ($r['is_active'] ?? 0),
        ];
    }
}
