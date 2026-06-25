<?php

namespace App\Controllers\Api;

use App\Models\OrderModel;
use App\Models\OrderReturnModel;
use App\Services\NotificationService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Vendor review of return requests for THEIR OWN orders. Replaces the old
 * admin-only flow: a customer's return now lands on the shop that fulfilled the
 * order, and the shop approves/rejects it (the customer is notified). Scoped so
 * a vendor only ever sees / decides returns on their own orders.
 */
class VendorReturnController extends BaseApiController
{
    public function index(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'vendor') return $this->fail('Forbidden', 403);

        $rows = \Config\Database::connect()->query(
            "SELECT r.id, r.order_id, r.customer_id, r.reason, r.images, r.status, r.created_at,
                    o.total, o.status AS order_status, o.delivered_at,
                    cu.name AS customer_name, cu.mobile_number AS customer_mobile
             FROM order_returns r
             JOIN orders o      ON o.id = r.order_id AND o.vendor_id = ?
             LEFT JOIN users cu ON cu.id = r.customer_id
             ORDER BY r.id DESC
             LIMIT 300",
            [(int) $auth->id]
        )->getResultArray();

        // Decode the stored image paths into absolute URLs for the thumbnails.
        foreach ($rows as &$r) {
            $paths = json_decode((string) ($r['images'] ?? ''), true);
            $r['image_urls'] = is_array($paths) ? array_map(static fn ($p) => base_url($p), $paths) : [];
            unset($r['images']);
        }
        unset($r);

        return $this->ok(['items' => $rows]);
    }

    public function approve(int $id): ResponseInterface { return $this->decide($id, 'approved'); }
    public function reject(int $id): ResponseInterface  { return $this->decide($id, 'rejected'); }

    /** Approve/reject — only on the calling vendor's own order; notifies customer. */
    private function decide(int $id, string $to): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'vendor') return $this->fail('Forbidden', 403);

        $m   = new OrderReturnModel();
        $row = $m->find($id);
        if (! $row) return $this->fail('Not found', 404);

        $order = (new OrderModel())->find((int) $row['order_id']);
        if (! $order || (int) ($order['vendor_id'] ?? 0) !== (int) $auth->id) {
            return $this->fail('Forbidden', 403);
        }
        if (($row['status'] ?? '') !== 'pending') {
            return $this->fail('Already ' . ($row['status'] ?? 'reviewed'), 409);
        }

        $m->update($id, ['status' => $to]);

        $title = $to === 'approved' ? 'Return approved' : 'Return declined';
        $body  = $to === 'approved'
            ? "Your return for order #{$row['order_id']} was approved by the shop."
            : "Your return for order #{$row['order_id']} was declined by the shop.";
        try {
            (new NotificationService())->sendTyped((int) $row['customer_id'], 'order_update', (int) $row['order_id'], '/orders', $title, $body);
        } catch (\Throwable $e) {
            log_message('error', 'Vendor return decision notify failed: ' . $e->getMessage());
        }

        return $this->ok(null, $to === 'approved' ? 'Approved' : 'Rejected');
    }
}
