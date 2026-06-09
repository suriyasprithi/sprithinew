<?php

namespace App\Controllers\Api;

use App\Models\CartItemModel;
use App\Models\CustomerAddressModel;
use App\Models\DeliveryTimeRateModel;
use App\Models\OrderItemModel;
use App\Models\OrderModel;
use App\Models\ProductModel;
use App\Models\ProductVariantModel;
use App\Models\UserModel;
use App\Models\VendorProfileModel;
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
        $body          = $this->request->getJSON(true) ?? $this->request->getPost() ?? [];
        $notes         = (string) ($body['notes'] ?? '');
        $paymentMethod = (($body['payment_method'] ?? 'wallet') === 'cod') ? 'cod' : 'wallet';

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

        // Delivery fee: validate the customer's chosen time-rate against the cart
        // vendor's taluk server-side (never trust a client-sent amount). The order
        // total becomes items_subtotal ($total) + delivery fee, but all vendor /
        // commission / token math below stays on $total (items only) so the vendor
        // never gets a cut of the delivery fee.
        $deliveryFee     = 0.0;
        $deliveryMinutes = null;
        $rateId = (int) ($body['delivery_rate_id'] ?? 0);
        if ($rateId && $vendorId) {
            $vp      = (new VendorProfileModel())->where('user_id', $vendorId)->first();
            $talukId = (int) ($vp['taluk_id'] ?? 0);
            $rate    = (new DeliveryTimeRateModel())->find($rateId);
            if ($rate && $talukId && (int) $rate['taluk_id'] === $talukId) {
                $deliveryFee     = (float) $rate['price'];
                $deliveryMinutes = (int) $rate['time_min'];
            }
        }
        $grandTotal = $total + $deliveryFee;

        // Wallet check (only when paying from wallet; COD is collected on delivery)
        $users = new UserModel();
        $u = $users->find($auth->id);

        // Resolve the delivery address snapshot. Prefer the address the customer
        // chose at checkout; fall back to their default saved address, then to
        // the legacy users-row address. Stored on the order so the driver sees
        // the address used at the time — unaffected by later edits.
        $addrModel = new CustomerAddressModel();
        $addrId    = (int) ($body['address_id'] ?? 0);
        if ($addrId) {
            $addrRow = $addrModel->ownedBy($addrId, (int) $auth->id);
            if (! $addrRow) return $this->fail('Invalid delivery address', 422);
        } else {
            $addrRow = $addrModel->where('customer_id', (int) $auth->id)
                ->orderBy('is_default', 'DESC')->orderBy('id', 'DESC')->first();
        }
        $deliveryAddress = $addrRow
            ? CustomerAddressModel::formatLine($addrRow)
            : CustomerAddressModel::formatLine([
                'address_line' => $u['address_line'] ?? null,
                'landmark'     => $u['landmark'] ?? null,
                'city'         => $u['city'] ?? null,
                'pincode'      => $u['pincode'] ?? null,
            ]);
        if ($deliveryAddress === '') {
            return $this->fail('Add a delivery address before placing your order', 422);
        }
        if ($paymentMethod === 'wallet' && (float) ($u['wallet_balance'] ?? 0) < $grandTotal) {
            return $this->fail('Insufficient wallet balance', 402);
        }

        // Vendor inventory tokens: deduct items_subtotal × vendor.commission_pct
        // (1 token = ₹1). This must never block the customer's order or surface a
        // vendor-side shortage message — deduct what's available and move on.
        if ($vendorId) {
            try {
                (new TokenService())->consumeForOrder($vendorId, (float) $total);
            } catch (\Throwable $e) {
                log_message('error', 'Token consume skipped for order: ' . $e->getMessage());
            }
        }

        $orderModel = new OrderModel();
        $itemModel  = new OrderItemModel();
        $orderId = $orderModel->insert([
            'customer_id'    => $auth->id,
            'vendor_id'      => $vendorId,
            'total'          => $grandTotal,
            'delivery_fee'   => $deliveryFee,
            'delivery_minutes' => $deliveryMinutes,
            'payment_method' => $paymentMethod,
            // Wallet orders are paid up-front; COD stays 'pending' until delivered.
            'status'         => $paymentMethod === 'cod' ? 'pending' : 'paid',
            'notes'          => $notes ?: null,
            'delivery_address' => $deliveryAddress,
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

        // Wallet orders settle immediately: debit the customer, credit the vendor
        // 90%, and (below) run the commission cascade. COD defers all of this to
        // delivery — see setStatus().
        if ($paymentMethod === 'wallet') {
            $users->update($auth->id, ['wallet_balance' => (float) $u['wallet_balance'] - $grandTotal]);
            (new WalletTransactionModel())->insert([
                'user_id'   => $auth->id,
                'amount'    => $grandTotal,
                'type'      => 'payment',
                'reference' => 'order#' . $orderId,
                'notes'     => 'Order #' . $orderId,
            ]);

            // Credit vendor 90% of the items subtotal — the remaining 10% becomes
            // the commission pool distributed by CommissionService below. The
            // vendor never gets a share of the delivery fee.
            if ($vendorId) {
                $vendorShare = round((float) $total * 0.90, 2);
                (new WalletService())->credit($vendorId, 'wallet', $vendorShare, 'receive', 'order#' . $orderId, 'Sale (90% of order)');
            }

            // Delivery fee is the platform's logistics revenue → admin pool, so the
            // amount debited from the customer is fully accounted for.
            if ($deliveryFee > 0) {
                \Config\Database::connect()->table('system_pools')
                    ->where('pool_key', 'admin_wallet')
                    ->set('balance', "balance + {$deliveryFee}", false)
                    ->update();
            }
        }

        // Clear cart
        (new CartItemModel())->where('user_id', $auth->id)->delete();

        // Build the success response. Push it to the client NOW (before
        // notifications + commission cascade) so the customer doesn't wait
        // for FCM round-trips. The slow work happens after the response.
        $response = $this->ok(['order_id' => (int) $orderId], 'Order placed');
        $this->sendEarly($response);

        // Notify customer + vendor + all admins (slow — runs after response)
        $svc = new NotificationService();
        try {
            $svc->sendTyped((int) $auth->id, 'order_created', (int) $orderId, '/orders', 'Order placed', "Total ₹{$grandTotal}");
            if ($vendorId) {
                $svc->sendTyped($vendorId, 'order_created', (int) $orderId, '/orders', 'New order', "Order #{$orderId} — ₹{$grandTotal}");
                // Notify driver(s) assigned to this vendor — the order is theirs to deliver.
                $drivers = (new UserModel())
                    ->where('assigned_vendor_id', $vendorId)
                    ->where('role', 'driver')
                    ->where('status', 'active')
                    ->findAll();
                foreach ($drivers as $d) {
                    $svc->sendTyped((int) $d['id'], 'order_created', (int) $orderId, '/driver/orders', 'New delivery', "Order #{$orderId} — ₹{$grandTotal} ready to deliver");
                }
            }
            $svc->sendTypedToRole('admin', 'order_created', (int) $orderId, '/orders', 'New order', "Order #{$orderId} — ₹{$grandTotal}");
        } catch (\Throwable $e) {
            log_message('error', 'Order push failed: ' . $e->getMessage());
        }

        // MLM commission cascade — wallet only; COD runs this on delivery.
        if ($paymentMethod === 'wallet') {
            (new CommissionService())->distributeForOrder((int) $orderId, (int) $auth->id, (float) $total, $vendorId);
        }

        return $response;
    }

    /**
     * Send the response to the client immediately and keep PHP running so
     * post-response work (notifications, commission cascade) doesn't block
     * the customer.
     *
     * Works under PHP-FPM via fastcgi_finish_request; falls back to
     * Content-Length + flush trick for Apache mod_php.
     */
    private function sendEarly(ResponseInterface $response): void
    {
        ignore_user_abort(true);
        set_time_limit(0);

        $body = (string) $response->getBody();
        $response->setHeader('Content-Length', (string) strlen($body));
        // Send headers + body now
        $response->pretend(false)->send();

        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        } else {
            // mod_php: flush output buffers so the client gets the body now.
            while (ob_get_level() > 0) {
                @ob_end_flush();
            }
            @flush();
        }

        // Empty the body so the framework's later $response->send() doesn't
        // duplicate output. Headers already sent → sendHeaders is a no-op.
        $response->setBody('');
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
                    d.name        AS district_name,
                    dr.name       AS driver_name
             FROM orders o
             LEFT JOIN users u             ON u.id = o.vendor_id
             LEFT JOIN vendor_profiles vp  ON vp.user_id = o.vendor_id
             LEFT JOIN taluks t            ON t.id = vp.taluk_id
             LEFT JOIN districts d         ON d.id = t.district_id
             LEFT JOIN users dr            ON dr.id = o.driver_id
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

        // Delivering driver (+ ID-card proof) for the customer, when one is stamped.
        $driver = null;
        if (! empty($order['driver_id'])) {
            $dr = (new UserModel())->find((int) $order['driver_id']);
            if ($dr) {
                $driver = [
                    'id'          => (int) $dr['id'],
                    'name'        => $dr['name'],
                    'mobile'      => $dr['mobile_number'] ?? null,
                    'id_card_url' => $dr['id_card_url'] ?? null,
                ];
            }
        }

        return $this->ok(['order' => $order, 'items' => $items, 'driver' => $driver]);
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

    /**
     * Orders awaiting delivery for the current driver's assigned vendor.
     * Returns shipped + paid orders (paid = upcoming, shipped = ready to deliver).
     */
    public function driverOrders(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'driver') return $this->fail('Forbidden', 403);

        $users = new UserModel();
        $driver = $users->find((int) $auth->id);
        $vendorId = (int) ($driver['assigned_vendor_id'] ?? 0);
        if (! $vendorId) return $this->ok(['items' => []]);

        // Deliverable = new COD orders awaiting delivery (pending) + wallet orders
        // (paid/shipped). Legacy-imported orders are excluded — they were handled
        // on the old site and must not reappear in the driver queue.
        $db = \Config\Database::connect();
        $legacyIds = [];
        if ($db->tableExists('legacy_id_map')) {
            foreach ($db->table('legacy_id_map')->select('new_id')->where('old_table', 'order')->get()->getResultArray() as $r) {
                $legacyIds[] = (int) $r['new_id'];
            }
        }
        $builder = (new OrderModel())
            ->where('vendor_id', $vendorId)
            ->whereIn('status', ['pending', 'paid', 'shipped']);
        if ($legacyIds) $builder->whereNotIn('id', $legacyIds);
        $orders = $builder->orderBy('id', 'DESC')->findAll(200);
        if (! $orders) return $this->ok(['items' => []]);

        // Vendor profile for pickup address
        $vendor = $users->find($vendorId);
        $vProfile = (new VendorProfileModel())->find($vendorId) ?: [];
        $pickup = trim(implode(', ', array_filter([
            $vProfile['shop_name'] ?? null,
            $vProfile['address'] ?? null,
            $vProfile['area']    ?? null,
            $vProfile['pincode'] ?? null,
        ])));

        // Customer details for drops
        $custIds = array_values(array_unique(array_map(static fn ($o) => (int) $o['customer_id'], $orders)));
        $customers = $custIds ? $users->whereIn('id', $custIds)->findAll() : [];
        $byId = [];
        foreach ($customers as $c) $byId[(int) $c['id']] = $c;

        $items = [];
        foreach ($orders as $o) {
            $c = $byId[(int) $o['customer_id']] ?? null;
            // Prefer the address snapshotted on the order at checkout; fall back
            // to the customer's live address for legacy orders without a snapshot.
            $drop = trim((string) ($o['delivery_address'] ?? ''));
            if ($drop === '') {
                $dropParts = $c ? array_filter([
                    $c['address_line'] ?? null,
                    ! empty($c['landmark']) ? 'Near ' . $c['landmark'] : null,
                    $c['city']    ?? null,
                    $c['pincode'] ?? null,
                ]) : [];
                $drop = $dropParts ? implode(', ', $dropParts) : ($c['name'] ?? '');
            }
            $items[] = [
                'id'              => (int) $o['id'],
                'status'          => $o['status'],
                'total'           => (float) $o['total'],
                'pickup_address'  => $pickup ?: ($vendor['name'] ?? 'Vendor'),
                'drop_address'    => $drop ?: 'Customer',
                'customer_name'   => $c['name']          ?? '',
                'customer_mobile' => $c['mobile_number'] ?? '',
                'created_at'      => $o['created_at'] ?? null,
            ];
        }
        return $this->ok(['items' => $items]);
    }

    /** True if this order id came from the legacy import (so COD must not re-settle). */
    private function isLegacyOrder(int $orderId): bool
    {
        $db = \Config\Database::connect();
        if (! $db->tableExists('legacy_id_map')) return false;
        return (bool) $db->table('legacy_id_map')
            ->where('old_table', 'order')
            ->where('new_id', $orderId)
            ->countAllResults();
    }

    public function setStatus(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, ['vendor', 'admin', 'driver'], true)) return $this->fail('Forbidden', 403);

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $status = (string) ($d['status'] ?? '');
        if (! in_array($status, ['pending', 'paid', 'shipped', 'delivered', 'cancelled'], true)) {
            return $this->fail('Invalid status', 422);
        }

        $model = new OrderModel();
        $order = $model->find($id);
        if (! $order) return $this->fail('Not found', 404);
        if ($auth->role === 'vendor' && (int) ($order['vendor_id'] ?? 0) !== (int) $auth->id) return $this->fail('Forbidden', 403);
        if ($auth->role === 'driver') {
            $driver = (new UserModel())->find((int) $auth->id);
            if (! $driver || (int) ($driver['assigned_vendor_id'] ?? 0) !== (int) ($order['vendor_id'] ?? 0)) {
                return $this->fail('Forbidden', 403);
            }
            if ($status !== 'delivered') return $this->fail('Drivers can only mark delivered', 403);
        }

        $patch = ['status' => $status];
        // Record which driver handled the order so the customer can see who delivered it.
        if ($auth->role === 'driver') $patch['driver_id'] = (int) $auth->id;
        $model->update($id, $patch);

        // COD settles on delivery: the cash is now collected, so credit the vendor
        // 90% and run the commission cascade — exactly what a wallet order does at
        // placement. Guarded so it only fires on the first transition to delivered,
        // and never for legacy-imported orders (already settled on the old site —
        // their commissions came in as historical wallet_transactions).
        if ($status === 'delivered'
            && ($order['payment_method'] ?? 'wallet') === 'cod'
            && ($order['status'] ?? '') !== 'delivered'
            && ! $this->isLegacyOrder($id)) {
            $codVendorId = ! empty($order['vendor_id']) ? (int) $order['vendor_id'] : null;
            // Settle vendor share + commission on the items subtotal only — the
            // delivery fee (collected in cash) is not the vendor's revenue.
            $codItems = (float) $order['total'] - (float) ($order['delivery_fee'] ?? 0);
            if ($codVendorId) {
                $vendorShare = round($codItems * 0.90, 2);
                (new WalletService())->credit($codVendorId, 'wallet', $vendorShare, 'receive', 'order#' . $id, 'COD sale (90% of order)');
            }
            (new CommissionService())->distributeForOrder($id, (int) $order['customer_id'], $codItems, $codVendorId);
        }

        try {
            (new NotificationService())->sendTyped((int) $order['customer_id'], 'order_update', $id, '/orders', "Order #{$id}", "Status updated to {$status}");
        } catch (\Throwable $e) {
            log_message('error', 'Order status push failed: ' . $e->getMessage());
        }
        return $this->ok(null, 'Updated');
    }
}
