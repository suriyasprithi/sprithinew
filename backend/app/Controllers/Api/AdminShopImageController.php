<?php

namespace App\Controllers\Api;

use App\Models\UserModel;
use App\Models\VendorProfileModel;
use App\Services\NotificationService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Admin review of vendor shop images. Mirrors the ad-request approve/reject
 * flow (see AdRequestController) but state lives on vendor_profiles:
 *   image_pending → newly uploaded, awaiting review
 *   image         → the approved/live image shown to customers
 * Approve moves pending → live; reject records a reason for the vendor.
 */
class AdminShopImageController extends BaseApiController
{
    /** Pending shop-image submissions, newest first, with vendor + shop name. */
    public function index(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;

        $rows = (new VendorProfileModel())
            ->where('image_status', 'pending')
            ->orderBy('updated_at', 'DESC')
            ->findAll(300);

        $ids     = array_values(array_unique(array_map(static fn ($r) => (int) $r['user_id'], $rows)));
        $vendors = $ids ? (new UserModel())->whereIn('id', $ids)->findAll() : [];
        $vmap    = [];
        foreach ($vendors as $v) { $vmap[(int) $v['id']] = $v; }

        $items = array_map(static function ($r) use ($vmap) {
            $v = $vmap[(int) $r['user_id']] ?? [];
            return [
                'vendor_id'         => (int) $r['user_id'],
                'vendor_name'       => $v['name'] ?? '—',
                'shop_name'         => $r['shop_name'] ?? null,
                'image_url'         => ! empty($r['image']) ? base_url($r['image']) : null,
                'image_pending_url' => ! empty($r['image_pending']) ? base_url($r['image_pending']) : null,
                'updated_at'        => $r['updated_at'] ?? null,
            ];
        }, $rows);

        return $this->ok(['items' => $items]);
    }

    /** Approve: pending image becomes the live image shown to customers. */
    public function approve(int $userId): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;

        $vp  = new VendorProfileModel();
        $row = $vp->find($userId);
        if (! $row) return $this->fail('Not found', 404);
        if (($row['image_status'] ?? null) !== 'pending') return $this->fail('Already ' . ($row['image_status'] ?? 'reviewed'), 409);
        if (empty($row['image_pending'])) return $this->fail('No pending image to approve', 422);

        $vp->update($userId, [
            'image'               => $row['image_pending'],
            'image_pending'       => null,
            'image_status'        => 'approved',
            'image_reject_reason' => null,
            'image_reviewed_by'   => (int) $this->authUser()->id,
        ]);

        $this->notify($userId, 'Shop image approved', 'Your shop image is now live for customers.');
        return $this->ok(null, 'Approved');
    }

    /** Reject with a reason; the vendor can re-upload. Live image is untouched. */
    public function reject(int $userId): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;

        $d      = $this->request->getJSON(true) ?? $this->request->getPost() ?? [];
        $reason = trim((string) ($d['reason'] ?? ''));
        if ($reason === '') return $this->fail('Rejection reason is required', 422);

        $vp  = new VendorProfileModel();
        $row = $vp->find($userId);
        if (! $row) return $this->fail('Not found', 404);
        if (($row['image_status'] ?? null) !== 'pending') return $this->fail('Already ' . ($row['image_status'] ?? 'reviewed'), 409);

        $vp->update($userId, [
            'image_status'        => 'rejected',
            'image_reject_reason' => mb_substr($reason, 0, 255),
            'image_reviewed_by'   => (int) $this->authUser()->id,
        ]);

        $this->notify($userId, 'Shop image rejected', $reason);
        return $this->ok(null, 'Rejected');
    }

    private function notify(int $vendorId, string $title, string $body): void
    {
        try {
            (new NotificationService())->sendTyped($vendorId, 'shop_image', $vendorId, '/shop-image', $title, $body);
        } catch (\Throwable $e) {
            log_message('error', 'shop image notify failed: ' . $e->getMessage());
        }
    }

    private function requireAdmin(): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'admin') return $this->fail('Forbidden', 403);
        return null;
    }
}
