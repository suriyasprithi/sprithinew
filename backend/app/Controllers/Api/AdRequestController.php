<?php

namespace App\Controllers\Api;

use App\Models\AdRequestModel;
use App\Models\UserModel;
use App\Services\NotificationService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Vendor-submitted ad requests (banner image / promo video), reviewed by admin.
 * Modeled on the token-request create -> admin-inbox -> approve/reject flow.
 */
class AdRequestController extends BaseApiController
{
    private const TYPES = ['banner', 'video'];

    /** Multipart upload of the creative; `kind` = banner|video picks the limits. */
    public function upload(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $kind = $this->request->getPost('kind') === 'video' ? 'video' : 'banner';
        $file = $this->request->getFile('file');
        if (! $file || ! $file->isValid() || $file->hasMoved()) return $this->fail('No file uploaded', 422);

        if ($kind === 'video') {
            if ($file->getSize() > 25 * 1024 * 1024) return $this->fail('Video must be 25 MB or smaller', 422);
            if (! in_array($file->getMimeType(), ['video/mp4', 'video/webm', 'video/quicktime'], true)) {
                return $this->fail('File must be an MP4 or WEBM video', 422);
            }
        } else {
            if ($file->getSize() > 5 * 1024 * 1024) return $this->fail('Image must be 5 MB or smaller', 422);
            if (! in_array($file->getMimeType(), ['image/jpeg', 'image/png', 'image/webp'], true)) {
                return $this->fail('File must be a JPG, PNG or WEBP image', 422);
            }
        }

        $dir = FCPATH . 'uploads/ad-requests/';
        if (! is_dir($dir)) @mkdir($dir, 0775, true);
        $name = $file->getRandomName();
        $file->move($dir, $name);
        $path = 'uploads/ad-requests/' . $name;

        return $this->ok(['path' => $path, 'url' => base_url($path)], 'Uploaded');
    }

    /** Vendor submits a request: { type, attachment, notes }. */
    public function create(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'vendor') return $this->fail('Only vendors can request ads', 403);

        $d    = $this->request->getJSON(true) ?? $this->request->getPost();
        $type = in_array(($d['type'] ?? ''), self::TYPES, true) ? $d['type'] : null;
        if (! $type) return $this->fail('Invalid ad type', 422);

        $id = (new AdRequestModel())->insert([
            'vendor_id'  => (int) $auth->id,
            'type'       => $type,
            'attachment' => isset($d['attachment']) && $d['attachment'] !== '' ? (string) $d['attachment'] : null,
            'notes'      => isset($d['notes']) && $d['notes'] !== '' ? trim((string) $d['notes']) : null,
            'status'     => 'pending',
        ], true);

        try {
            (new NotificationService())->sendTypedToRole(
                'admin', 'ad_request', (int) $id, '/ad-requests',
                'New ad request', ucfirst($type) . ' request from ' . ($auth->name ?? 'a vendor')
            );
        } catch (\Throwable $e) { log_message('error', 'ad request notify failed: ' . $e->getMessage()); }

        return $this->ok(['id' => (int) $id], 'Request submitted');
    }

    /** Vendor's own requests, optionally filtered by ?type=banner|video. */
    public function mine(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        $type = $this->request->getGet('type');
        $q = (new AdRequestModel())->where('vendor_id', (int) $auth->id);
        if (in_array($type, self::TYPES, true)) $q->where('type', $type);
        $rows = $q->orderBy('id', 'DESC')->findAll(100);
        return $this->ok(['items' => array_map([$this, 'decorate'], $rows)]);
    }

    /** Admin inbox — all requests, newest first, with vendor name. */
    public function adminIndex(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'admin') return $this->fail('Forbidden', 403);

        $rows = (new AdRequestModel())->orderBy('id', 'DESC')->findAll(300);
        $vids = array_values(array_unique(array_map(static fn ($r) => (int) $r['vendor_id'], $rows)));
        $vendors = $vids ? (new UserModel())->whereIn('id', $vids)->findAll() : [];
        $vname = []; foreach ($vendors as $v) $vname[(int) $v['id']] = $v['name'];

        $items = array_map(function ($r) use ($vname) {
            $row = $this->decorate($r);
            $row['vendor_name'] = $vname[(int) $r['vendor_id']] ?? '—';
            return $row;
        }, $rows);
        return $this->ok(['items' => $items]);
    }

    public function approve(int $id): ResponseInterface { return $this->decide($id, 'approved'); }
    public function reject(int $id): ResponseInterface  { return $this->decide($id, 'rejected'); }

    private function decide(int $id, string $status): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'admin') return $this->fail('Forbidden', 403);

        $m   = new AdRequestModel();
        $row = $m->find($id);
        if (! $row) return $this->fail('Not found', 404);
        if ($row['status'] !== 'pending') return $this->fail('Already ' . $row['status'], 409);

        $m->update($id, ['status' => $status, 'processed_by' => (int) $auth->id]);

        try {
            $route = $row['type'] === 'video' ? '/ad-video-request' : '/ad-banner-request';
            (new NotificationService())->sendTyped(
                (int) $row['vendor_id'], 'ad_request', $id, $route,
                'Ad request ' . $status, 'Your ' . $row['type'] . ' request was ' . $status . '.'
            );
        } catch (\Throwable $e) { log_message('error', 'ad decide notify failed: ' . $e->getMessage()); }

        return $this->ok(null, 'Request ' . $status);
    }

    private function decorate(array $r): array
    {
        return [
            'id'             => (int) $r['id'],
            'type'           => $r['type'],
            'attachment'     => $r['attachment'],
            'attachment_url' => $r['attachment'] ? base_url($r['attachment']) : null,
            'notes'          => $r['notes'],
            'status'         => $r['status'],
            'created_at'     => $r['created_at'],
        ];
    }
}
