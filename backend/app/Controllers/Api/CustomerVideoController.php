<?php

namespace App\Controllers\Api;

use App\Models\CustomerVideoModel;
use App\Models\UserModel;
use App\Services\NotificationService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Admin-managed promo videos for the customer home "Customer videos" carousel.
 * Admin uploads MP4/WEBM/MOV directly (no vendor request) and can activate /
 * deactivate each one. Paths are stored relative and returned root-relative so
 * the <video> resolves against the serving origin (base_url is pinned to
 * app.baseURL and breaks on a different port).
 */
class CustomerVideoController extends BaseApiController
{
    /** Public: active videos for the home carousel, in display order. */
    public function publicIndex(): ResponseInterface
    {
        $rows = (new CustomerVideoModel())
            ->where('status', 'active')
            ->orderBy('sort_order', 'ASC')->orderBy('id', 'DESC')
            ->findAll(30);

        $items = array_map(static fn ($r) => [
            'id'        => (int) $r['id'],
            'title'     => $r['title'],
            'video_url' => '/' . ltrim($r['video_path'], '/'),
        ], $rows);

        return $this->ok(['items' => $items]);
    }

    /** Admin: every video (active + inactive + pending + rejected), newest first. */
    public function adminIndex(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;

        $rows = (new CustomerVideoModel())
            ->orderBy('sort_order', 'ASC')->orderBy('id', 'DESC')
            ->findAll(100);

        $uids  = array_values(array_unique(array_filter(array_map(static fn ($r) => (int) ($r['submitted_by'] ?? 0), $rows))));
        $uname = [];
        if ($uids) {
            foreach ((new UserModel())->whereIn('id', $uids)->findAll() as $u) $uname[(int) $u['id']] = $u['name'];
        }

        $items = array_map(static function ($r) use ($uname) {
            $sb = (int) ($r['submitted_by'] ?? 0);
            return [
                'id'             => (int) $r['id'],
                'title'          => $r['title'],
                'video_url'      => '/' . ltrim($r['video_path'], '/'),
                'sort_order'     => (int) $r['sort_order'],
                'status'         => $r['status'],
                'submitted_by'   => $sb ?: null,
                'submitter_name' => $sb ? ($uname[$sb] ?? '—') : null,
                'created_at'     => $r['created_at'],
            ];
        }, $rows);

        return $this->ok(['items' => $items]);
    }

    /** Customer: multipart upload of a video to submit for admin approval. */
    public function customerUpload(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $file = $this->request->getFile('file');
        if (! $file || ! $file->isValid() || $file->hasMoved()) return $this->fail('No file uploaded', 422);
        if ($file->getSize() > 25 * 1024 * 1024) return $this->fail('Video must be 25 MB or smaller', 422);
        if (! in_array($file->getMimeType(), ['video/mp4', 'video/webm', 'video/quicktime'], true)) {
            return $this->fail('File must be an MP4 or WEBM video', 422);
        }

        $dir = FCPATH . 'uploads/customer-videos/';
        if (! is_dir($dir)) @mkdir($dir, 0775, true);
        $name = $file->getRandomName();
        $file->move($dir, $name);

        return $this->ok(['path' => 'uploads/customer-videos/' . $name], 'Uploaded');
    }

    /** Customer: submit an uploaded video for admin approval (status=pending). */
    public function customerSubmit(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $d    = $this->request->getJSON(true) ?? $this->request->getPost();
        $path = isset($d['video_path']) ? trim((string) $d['video_path']) : '';
        if ($path === '') return $this->fail('video_path is required', 422);

        $id = (new CustomerVideoModel())->insert([
            'title'        => isset($d['title']) && $d['title'] !== '' ? mb_substr((string) $d['title'], 0, 200) : null,
            'video_path'   => $path,
            'sort_order'   => 0,
            'status'       => 'pending',
            'submitted_by' => (int) $auth->id,
        ], true);

        try {
            (new NotificationService())->sendTypedToRole(
                'admin', 'customer_video', (int) $id, '/customer-videos',
                'New customer video', 'A video was submitted by ' . ($auth->name ?? 'a customer') . ' for approval.'
            );
        } catch (\Throwable $e) { log_message('error', 'customer video notify failed: ' . $e->getMessage()); }

        return $this->ok(['id' => (int) $id], 'Submitted for approval');
    }

    /** Customer: their own submissions + status. */
    public function mySubmissions(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $rows = (new CustomerVideoModel())
            ->where('submitted_by', (int) $auth->id)
            ->orderBy('id', 'DESC')->findAll(50);

        $items = array_map(static fn ($r) => [
            'id'         => (int) $r['id'],
            'title'      => $r['title'],
            'video_url'  => '/' . ltrim((string) $r['video_path'], '/'),
            'status'     => $r['status'],
            'created_at' => $r['created_at'],
        ], $rows);

        return $this->ok(['items' => $items]);
    }

    /** Admin: multipart upload of the video file. Returns the stored path. */
    public function upload(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;

        $file = $this->request->getFile('file');
        if (! $file || ! $file->isValid() || $file->hasMoved()) return $this->fail('No file uploaded', 422);
        if ($file->getSize() > 25 * 1024 * 1024) return $this->fail('Video must be 25 MB or smaller', 422);
        if (! in_array($file->getMimeType(), ['video/mp4', 'video/webm', 'video/quicktime'], true)) {
            return $this->fail('File must be an MP4 or WEBM video', 422);
        }

        $dir = FCPATH . 'uploads/customer-videos/';
        if (! is_dir($dir)) @mkdir($dir, 0775, true);
        $name = $file->getRandomName();
        $file->move($dir, $name);

        return $this->ok(['path' => 'uploads/customer-videos/' . $name], 'Uploaded');
    }

    /** Admin: create a video record from an uploaded path. */
    public function create(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;

        $d    = $this->request->getJSON(true) ?? $this->request->getPost();
        $path = isset($d['video_path']) ? trim((string) $d['video_path']) : '';
        if ($path === '') return $this->fail('video_path is required', 422);

        $id = (new CustomerVideoModel())->insert([
            'title'      => isset($d['title']) && $d['title'] !== '' ? mb_substr((string) $d['title'], 0, 200) : null,
            'video_path' => $path,
            'sort_order' => (int) ($d['sort_order'] ?? 0),
            'status'     => 'active',
        ], true);

        return $this->ok(['id' => (int) $id], 'Video added');
    }

    /** Admin: update title / sort_order / status (active|inactive). */
    public function update(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;

        $m   = new CustomerVideoModel();
        $row = $m->find($id);
        if (! $row) return $this->fail('Not found', 404);

        $d       = $this->request->getJSON(true) ?? $this->request->getPost();
        $payload = [];
        if (array_key_exists('title', $d))      $payload['title']      = $d['title'] !== '' ? mb_substr((string) $d['title'], 0, 200) : null;
        if (array_key_exists('sort_order', $d)) $payload['sort_order'] = (int) $d['sort_order'];
        if (array_key_exists('status', $d) && in_array($d['status'], ['active', 'inactive', 'rejected'], true)) {
            $payload['status'] = $d['status'];
        }
        if ($payload) $m->update($id, $payload);

        // Notify the submitter when their pending video is approved (active) or rejected.
        $newStatus = $payload['status'] ?? null;
        $sb        = (int) ($row['submitted_by'] ?? 0);
        if ($sb && ($row['status'] ?? '') === 'pending' && in_array($newStatus, ['active', 'rejected'], true)) {
            try {
                $approved = $newStatus === 'active';
                (new NotificationService())->sendTyped(
                    $sb, 'customer_video', $id, '/dashboard',
                    $approved ? 'Video approved' : 'Video not approved',
                    $approved ? 'Your video is now live on the home page.' : 'Your submitted video was not approved.'
                );
            } catch (\Throwable $e) { log_message('error', 'customer video decide notify failed: ' . $e->getMessage()); }
        }

        return $this->ok(null, 'Updated');
    }

    /** Admin: delete a video record (and its file). */
    public function delete(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;

        $m   = new CustomerVideoModel();
        $row = $m->find($id);
        if (! $row) return $this->fail('Not found', 404);

        $file = FCPATH . ltrim((string) $row['video_path'], '/');
        if (is_file($file)) @unlink($file);
        $m->delete($id);

        return $this->ok(null, 'Deleted');
    }

    private function requireAdmin(): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'admin') return $this->fail('Forbidden', 403);
        return null;
    }
}
