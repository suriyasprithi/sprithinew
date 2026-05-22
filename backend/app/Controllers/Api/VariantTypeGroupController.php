<?php

namespace App\Controllers\Api;

use App\Models\VariantTypeGroupModel;
use CodeIgniter\HTTP\ResponseInterface;

class VariantTypeGroupController extends BaseApiController
{
    /** Admin: full list including inactive. */
    public function adminIndex(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $rows = (new VariantTypeGroupModel())->orderBy('id', 'DESC')->findAll();
        return $this->ok(['items' => array_map([$this, 'decode'], $rows)]);
    }

    /**
     * Active groups, optionally filtered by ?category_id=N.
     * Used by the vendor product form to render category-driven variant pickers.
     */
    public function index(): ResponseInterface
    {
        $model = (new VariantTypeGroupModel())->where('status', 'active');
        $cid = (int) $this->request->getGet('category_id');
        if ($cid > 0) $model->where('category_id', $cid);
        $rows = $model->orderBy('id', 'ASC')->findAll();
        return $this->ok(['items' => array_map([$this, 'decode'], $rows)]);
    }

    public function create(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        if (! $this->validate(['name' => 'required|string|max_length[100]'])) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }
        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $fields = $this->normalizeFields($d['fields'] ?? []);
        $id = (new VariantTypeGroupModel())->insert([
            'name'        => trim((string) $d['name']),
            'category_id' => isset($d['category_id']) && $d['category_id'] !== '' && $d['category_id'] !== null
                ? (int) $d['category_id']
                : null,
            'fields'      => json_encode($fields, JSON_UNESCAPED_UNICODE),
            'status'      => in_array($d['status'] ?? 'active', ['active', 'inactive'], true) ? $d['status'] : 'active',
        ], true);
        return $this->ok(['id' => (int) $id], 'Created');
    }

    public function update(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $model = new VariantTypeGroupModel();
        if (! $model->find($id)) return $this->fail('Not found', 404);

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $payload = [];
        if (isset($d['name'])) $payload['name'] = trim((string) $d['name']);
        if (isset($d['status']) && in_array($d['status'], ['active', 'inactive'], true)) {
            $payload['status'] = $d['status'];
        }
        if (array_key_exists('category_id', $d)) {
            $payload['category_id'] = $d['category_id'] === null || $d['category_id'] === ''
                ? null
                : (int) $d['category_id'];
        }
        if (array_key_exists('fields', $d)) {
            $payload['fields'] = json_encode($this->normalizeFields($d['fields']), JSON_UNESCAPED_UNICODE);
        }
        if (! $payload) return $this->fail('Nothing to update', 422);
        $model->update($id, $payload);
        return $this->ok(null, 'Updated');
    }

    public function delete(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        (new VariantTypeGroupModel())->delete($id);
        return $this->ok(null, 'Deleted');
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
        $row['category_id'] = isset($row['category_id']) ? (int) $row['category_id'] : null;
        $raw = $row['fields'] ?? null;
        $row['fields'] = is_string($raw) ? (json_decode($raw, true) ?: []) : (is_array($raw) ? $raw : []);
        return $row;
    }

    /**
     * Strip dynamic-fields list to a known shape (same as categories.attribute_schema).
     * Accepts: [{ key, label, type, required?, options?, unit?, placeholder? }, ...]
     */
    private function normalizeFields(mixed $raw): array
    {
        if (! is_array($raw)) return [];
        $out   = [];
        $types = ['text', 'textarea', 'number', 'date', 'select', 'toggle', 'image', 'color'];
        foreach ($raw as $field) {
            if (! is_array($field)) continue;
            $key   = trim((string) ($field['key']   ?? ''));
            $label = trim((string) ($field['label'] ?? ''));
            $type  = (string) ($field['type'] ?? 'text');
            if ($key === '' || $label === '' || ! in_array($type, $types, true)) continue;

            $clean = ['key' => $key, 'label' => $label, 'type' => $type];
            if (! empty($field['required']))    $clean['required']    = true;
            if (! empty($field['unit']))        $clean['unit']        = (string) $field['unit'];
            if (! empty($field['placeholder'])) $clean['placeholder'] = (string) $field['placeholder'];
            if ($type === 'select' && isset($field['options']) && is_array($field['options'])) {
                $clean['options'] = array_values(array_filter(array_map('strval', $field['options']), static fn ($s) => $s !== ''));
            }
            $out[] = $clean;
        }
        return $out;
    }
}
