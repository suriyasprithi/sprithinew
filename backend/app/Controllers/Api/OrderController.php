<?php

namespace App\Controllers\Api;

use App\Models\CartItemModel;
use App\Models\OrderItemModel;
use App\Models\OrderModel;
use App\Models\ProductModel;
use App\Models\ProductVariantModel;
use App\Models\UserModel;
use App\Models\WalletTransactionModel;
use App\Services\CommissionService;
use App\Services\NotificationService;
use App\Services\TokenService;
use App\Services\WalletService;
use CodeIgniter\HTTP\ResponseInterface;

class OrderController extends BaseApiController
{
    /** Customer: place order from current cart, charge wallet. */
    public function place(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        $notes = (string) ($this->request->getJSON(true)['notes'] ?? $this->request->getPost('notes') ?? '');

        $cart = (new CartItemModel())->where('user_id', $auth->id)->findAll();
        if (! $cart) return $this->fail('Cart is empty', 422);

        $ids  = array_map(static fn ($r) => (int) $r['product_id'], $cart);
        $vids = array_values(array_filter(array_map(static fn ($r) => (int) ($r['variation_id'] ?? 0), $cart)));
        $products = (new ProductModel())->whereIn('id', $ids)->findAll();
        $variants = $vids ? (new ProductVariantModel())->whereIn('id', $vids)->findAll() : [];
        $byId = [];  foreach ($products as $p) $byId[(int) $p['id']]  = $p;
        $vById = []; foreach ($variants as $v) $vById[(int) $v['id']] = $v;

        $total = 0;
        $vendorIds = [];
        foreach ($cart as $r) {
            $p = $byId[(int) $r['product_id']] ?? null;
            if (! $p || $p['status'] !== 'active') return $this->fail('Some products are unavailable', 409);
            $vid   = (int) ($r['variation_id'] ?? 0);
            $price = (float) $p['price'];
            if ($vid) {
                $v = $vById[$vid] ?? null;
                if (! $v || $v['status'] !== 'active') return $this->fail('Some variants are unavailable', 409);
                if ((int) $v['stock'] < (int) $r['qty']) return $this->fail('Insufficient stock', 409);
                $price = (float) $v['price'];
            }
            $total += $price * (int) $r['qty'];
            $vendorIds[] = (int) $p['vendor_id'];
        }
        $vendorId = count(array_unique($vendorIds)) === 1 ? $vendorIds[0] : null;

        // Wallet check
        $users = new UserModel();
        $u = $users->find($auth->id);
        if ((float) ($u['wallet_balance'] ?? 0) < $total) {
            return $this->fail('Insufficient wallet balance', 402);
        }

        // Vendor inventory tokens: deduct items_subtotal × vendor.commission_pct
        // (1 token = ₹1). Rejected before any writes so the order is atomic.
        if ($vendorId) {
            try {
                (new TokenService())->consumeForOrder($vendorId, (float) $total);
            } catch (\DomainException $e) {
                return $this->fail($e->getMessage(), 409);
            }
        }

        $orderModel = new OrderModel();
        $itemModel  = new OrderItemModel();
        $orderId = $orderModel->insert([
            'customer_id' => $auth->id,
            'vendor_id'   => $vendorId,
            'total'       => $total,
            'status'      => 'paid',
            'notes'       => $notes ?: null,
        ], true);

        foreach ($cart as $r) {
            $p = $byId[(int) $r['product_id']];
            $vid = (int) ($r['variation_id'] ?? 0) ?: null;
            $variant = $vid ? ($vById[$vid] ?? null) : null;
            $price = $variant ? (float) $variant['price'] : (float) $p['price'];
            $sub = $price * (int) $r['qty'];
            $itemModel->insert([
                'order_id'        => $orderId,
                'product_id'      => (int) $p['id'],
                'variation_id'    => $vid,
                'variation_label' => $variant['name'] ?? null,
                'name'            => $p['name'],
                'qty'             => (int) $r['qty'],
                'price'           => $price,
                'subtotal'        => $sub,
            ]);
            if ($variant) {
                (new ProductVariantModel())->update($variant['id'], ['stock' => max(0, (int) $variant['stock'] - (int) $r['qty'])]);
            }
        }

        // Debit customer wallet + record transaction
        $users->update($auth->id, ['wallet_balance' => (float) $u['wallet_balance'] - $total]);
        (new WalletTransactionModel())->insert([
            'user_id'   => $auth->id,
            'amount'    => $total,
            'type'      => 'payment',
            'reference' => 'order#' . $orderId,
            'notes'     => 'Order #' . $orderId,
        ]);

        // Credit vendor 90% of total — the remaining 10% becomes the commission
        // pool distributed by CommissionService below.
        if ($vendorId) {
            $vendorShare = round((float) $total * 0.90, 2);
            (new WalletService())->credit($vendorId, 'wallet', $vendorShare, 'receive', 'order#' . $orderId, 'Sale (90% of order)');
        }

        // Clear cart
        (new CartItemModel())->where('user_id', $auth->id)->delete();

        // Notify customer + vendor + all admins
        $svc = new NotificationService();
        try {
            $svc->sendTyped((int) $auth->id, 'order_created', (int) $orderId, '/orders', 'Order placed', "Total ₹{$total}");
            if ($vendorId) {
                $svc->sendTyped($vendorId, 'order_created', (int) $orderId, '/orders', 'New order', "Order #{$orderId} — ₹{$total}");
            }
            $svc->sendTypedToRole('admin', 'order_created', (int) $orderId, '/orders', 'New order', "Order #{$orderId} — ₹{$total}");
        } catch (\Throwable $e) {
            log_message('error', 'Order push failed: ' . $e->getMessage());
        }

        // MLM commission cascade
        (new CommissionService())->distributeForOrder((int) $orderId, (int) $auth->id, (float) $total, $vendorId);

        return $this->ok(['order_id' => (int) $orderId], 'Order placed');
    }

    /** Customer: my orders, enriched with vendor + area. */
    public function mine(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $db = \Config\Database::connect();
        $rows = $db->query(
            'SELECT o.*,
                    u.name        AS vendor_name,
                    vp.shop_name  AS shop_name,
                    vp.area       AS area,
                    vp.pincode    AS pincode,
                    t.name        AS taluk_name,
                    d.name        AS district_name
             FROM orders o
             LEFT JOIN users u             ON u.id = o.vendor_id
             LEFT JOIN vendor_profiles vp  ON vp.user_id = o.vendor_id
             LEFT JOIN taluks t            ON t.id = vp.taluk_id
             LEFT JOIN districts d         ON d.id = t.district_id
             WHERE o.customer_id = ?
             ORDER BY o.id DESC
             LIMIT 100',
            [(int) $auth->id]
        )->getResultArray();

        return $this->ok(['items' => $rows]);
    }

    public function show(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        $order = (new OrderModel())->find($id);
        if (! $order) return $this->fail('Not found', 404);
        $isOwner   = (int) $order['customer_id'] === (int) $auth->id;
        $isVendor  = $auth->role === 'vendor' && (int) ($order['vendor_id'] ?? 0) === (int) $auth->id;
        $isAdmin   = $auth->role === 'admin';
        if (! $isOwner && ! $isVendor && ! $isAdmin) return $this->fail('Forbidden', 403);
        $items = (new OrderItemModel())->where('order_id', $id)->findAll();
        return $this->ok(['order' => $order, 'items' => $items]);
    }

    /** Vendor: orders for me. Admin: all orders. Supports ?status=&page=&per_page= */
    public function listForRole(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, ['vendor', 'admin'], true)) return $this->fail('Forbidden', 403);
        $p = $this->paging(20);

        $db = \Config\Database::connect();

        // Build WHERE clause
        $where  = ['1=1'];
        $params = [];
        if ($auth->role === 'vendor') { $where[] = 'o.vendor_id = ?'; $params[] = (int) $auth->id; }
        if ($status = $this->request->getGet('status')) { $where[] = 'o.status = ?'; $params[] = $status; }
        $whereSql = implode(' AND ', $where);

        $total = (int) ($db->query("SELECT COUNT(*) AS c FROM orders o WHERE $whereSql", $params)->getRow()->c ?? 0);

        $rows = $db->query(
            "SELECT o.id, o.customer_id, o.vendor_id, o.total, o.status, o.notes, o.created_at,
                    cu.name AS customer_name,
                    ve.name AS vendor_name,
                    vp.shop_name AS shop_name,
                    (SELECT COALESCE(SUM(qty),0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
             FROM orders o
             LEFT JOIN users cu            ON cu.id = o.customer_id
             LEFT JOIN users ve            ON ve.id = o.vendor_id
             LEFT JOIN vendor_profiles vp  ON vp.user_id = o.vendor_id
             WHERE $whereSql
             ORDER BY o.id DESC
             LIMIT {$p['perPage']} OFFSET {$p['offset']}",
            $params
        )->getResultArray();

        return $this->ok(['items' => $rows, 'total' => $total, 'page' => $p['page'], 'per_page' => $p['perPage']]);
    }

    public function setStatus(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, ['vendor', 'admin'], true)) return $this->fail('Forbidden', 403);

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $status = (string) ($d['status'] ?? '');
        if (! in_array($status, ['pending', 'paid', 'shipped', 'delivered', 'cancelled'], true)) {
            return $this->fail('Invalid status', 422);
        }

        $model = new OrderModel();
        $order = $model->find($id);
        if (! $order) return $this->fail('Not found', 404);
        if ($auth->role === 'vendor' && (int) ($order['vendor_id'] ?? 0) !== (int) $auth->id) return $this->fail('Forbidden', 403);

        $model->update($id, ['status' => $status]);
        try {
            (new NotificationService())->sendTyped((int) $order['customer_id'], 'order_update', $id, '/orders', "Order #{$id}", "Status updated to {$status}");
        } catch (\Throwable $e) {
            log_message('error', 'Order status push failed: ' . $e->getMessage());
        }
        return $this->ok(null, 'Updated');
    }
}
