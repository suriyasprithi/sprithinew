<?php

namespace App\Controllers\Api;

use App\Models\OrderReturnModel;
use App\Services\NotificationService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Admin review of customer return requests (order_returns). Lists every request
 * enriched with its order + customer; approve/reject flips the status and
 * notifies the customer. No refund / money movement — handled off-app.
 */
class AdminReturnController extends BaseApiController
{
    public function index(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;

        $rows = \Config\Database::connect()->query(
            "SELECT r.id, r.order_id, r.customer_id, r.reason, r.status, r.created_at,
                    o.total, o.status AS order_status, o.delivered_at,
                    cu.name AS customer_name, cu.mobile_number AS customer_mobile,
                    vp.shop_name, vu.name AS vendor_name
             FROM order_returns r
             LEFT JOIN orders o           ON o.id = r.order_id
             LEFT JOIN users cu           ON cu.id = r.customer_id
             LEFT JOIN users vu           ON vu.id = o.vendor_id
             LEFT JOIN vendor_profiles vp ON vp.user_id = o.vendor_id
             ORDER BY r.id DESC
             LIMIT 300"
        )->getResultArray();

        return $this->ok(['items' => $rows]);
    }

    public function approve(int $id): ResponseInterface { return $this->decide($id, 'approved'); }
    public function reject(int $id): ResponseInterface  { return $this->decide($id, 'rejected'); }

    /** Set a pending return to approved/rejected and notify the customer. */
    private function decide(int $id, string $to): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;

        $m   = new OrderReturnModel();
        $row = $m->find($id);
        if (! $row) return $this->fail('Not found', 404);
        if (($row['status'] ?? '') !== 'pending') return $this->fail('Already ' . ($row['status'] ?? 'reviewed'), 409);

        $m->update($id, ['status' => $to]);

        $title = $to === 'approved' ? 'Return approved' : 'Return declined';
        $body  = $to === 'approved'
            ? "Your return for order #{$row['order_id']} was approved."
            : "Your return for order #{$row['order_id']} was declined.";
        try {
            (new NotificationService())->sendTyped((int) $row['customer_id'], 'order_update', (int) $row['order_id'], '/orders', $title, $body);
        } catch (\Throwable $e) {
            log_message('error', 'Return decision notify failed: ' . $e->getMessage());
        }

        return $this->ok(null, $to === 'approved' ? 'Approved' : 'Rejected');
    }

    private function requireAdmin(): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'admin') return $this->fail('Forbidden', 403);
        return null;
    }
}
