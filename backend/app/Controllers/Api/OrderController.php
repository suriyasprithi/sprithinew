<?php

namespace App\Controllers\Api;

use App\Models\CartItemModel;
use App\Models\CustomerAddressModel;
use App\Models\DeliveryTimeRateModel;
use App\Models\OrderItemModel;
use App\Models\OrderModel;
use App\Models\OrderReturnModel;
use App\Models\ProductModel;
use App\Models\ProductVariantModel;
use App\Models\UserModel;
use App\Models\VendorProfileModel;
use App\Models\WalletTransactionModel;
use App\Services\CommissionService;
use App\Services\DeliveryChargeService;
use App\Services\NotificationService;
use App\Services\PrescriptionPolicy;
use App\Services\SystemSettingsService;
use App\Services\TokenService;
use App\Services\WalletService;
use CodeIgniter\HTTP\Files\UploadedFile;
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

        // Medicine-category items (medicals / siddha / homeopathy) require a
        // prescription file. This is the authoritative gate — the checkout
        // page also blocks placement, but never trust the client. The path
        // must be one we issued from uploadPrescription() and still on disk.
        $prescriptionPath     = trim((string) ($body['prescription_path'] ?? ''));
        $prescriptionRequired = PrescriptionPolicy::requiresFor($products);
        if ($prescriptionRequired) {
            if ($prescriptionPath === ''
                || ! str_starts_with($prescriptionPath, 'uploads/prescriptions/')
                || ! is_file(FCPATH . $prescriptionPath)) {
                return $this->fail('A prescription is required for medical items in your cart', 422);
            }
        } else {
            $prescriptionPath = '';  // ignore any stray value for non-medical carts
        }

        // Validate every line and bucket it under its product's vendor. A cart
        // spanning multiple shops becomes one order PER vendor, so each order has
        // a single vendor_id and the vendor list / payment / commission / driver
        // flows all work unchanged. $total stays the items-only grand subtotal.
        $total  = 0;
        $groups = [];   // vendorId => ['lines'=>[], 'subtotal'=>float, 'products'=>[]]
        foreach ($cart as $r) {
            $p = $byId[(int) $r['product_id']] ?? null;
            if (! $p || $p['status'] !== 'active') return $this->fail('Some products are unavailable', 409);
            $vid     = (int) ($r['variation_id'] ?? 0);
            $price   = (float) $p['price'];
            $variant = null;
            if ($vid) {
                $variant = $vById[$vid] ?? null;
                if (! $variant || $variant['status'] !== 'active') return $this->fail('Some variants are unavailable', 409);
                if ((int) $variant['stock'] < (int) $r['qty']) return $this->fail('Insufficient stock', 409);
                $price = (float) $variant['price'];
            } else {
                if ((int) ($p['stock'] ?? 0) < (int) $r['qty']) return $this->fail('Insufficient stock', 409);
            }
            $line   = $price * (int) $r['qty'];
            $total += $line;
            $vk = (int) $p['vendor_id'];
            if (! isset($groups[$vk])) $groups[$vk] = ['lines' => [], 'subtotal' => 0.0, 'products' => []];
            $groups[$vk]['lines'][]    = ['row' => $r, 'product' => $p, 'variant' => $variant, 'price' => $price];
            $groups[$vk]['products'][] = $p;
            $groups[$vk]['subtotal']  += $line;
        }

        // Customer-chosen delivery date+time (IST). The fee is computed by the
        // rule-based DeliveryChargeService from that datetime — paid window by the
        // chosen time-of-day, "chosen time > N hours ahead = free", else per-category
        // free-delivery thresholds — never a client amount. delivery_minutes is kept
        // as minutes-from-now for backward-compat display. The order total becomes
        // items_subtotal ($total) + delivery fee, but all vendor / commission / token
        // math below stays on $total (items only) so the vendor never gets a cut of
        // the delivery fee.
        $deliveryAt      = isset($body['delivery_at']) ? trim((string) $body['delivery_at']) : '';
        $deliveryAt      = $deliveryAt !== '' ? $deliveryAt : null;
        $deliveryAtSql   = null;
        $deliveryMinutes = null;
        if ($deliveryAt !== null) {
            try {
                $sel             = new \DateTime($deliveryAt, new \DateTimeZone('Asia/Kolkata'));
                $deliveryAtSql   = $sel->format('Y-m-d H:i:s');
                $deliveryMinutes = max(0, (int) round(($sel->getTimestamp() - time()) / 60));
            } catch (\Throwable $e) {
                $deliveryAtSql = null;
            }
        }
        // Per-shop delivery fee — summed model. An order scheduled beyond the
        // free-above-hours window is wholly free; otherwise each shop pays its own
        // vendor-category charge (A, per shop), plus a single evening surcharge
        // (B) and the chosen delivery-time slot price (C) — both attached once to
        // the first shop order. The slot also sets delivery SPEED (delivery_minutes).
        $deliveryRateId = isset($body['delivery_rate_id']) ? (int) $body['delivery_rate_id'] : 0;
        $rate           = $deliveryRateId > 0 ? (new DeliveryTimeRateModel())->find($deliveryRateId) : null;
        if ($rate) $deliveryMinutes = (int) $rate['time_min'];
        $slotPrice = $rate ? (float) $rate['price'] : 0.0;

        $deliverySvc   = new DeliveryChargeService();
        $freeByEta     = $deliverySvc->isFreeByEta($deliveryAt);
        $orderLevelFee = $freeByEta ? 0.0 : round($deliverySvc->eveningCharge($deliveryAt) + $slotPrice, 2); // B + C, once
        $totalDelivery = 0.0;
        $firstShop     = true;
        foreach ($groups as $vk => &$g) {
            $catCharge = $freeByEta ? 0.0 : $deliverySvc->categoryCharge(array_column($g['lines'], 'row')); // A, per shop
            $g['delivery_fee'] = round($catCharge + ($firstShop ? $orderLevelFee : 0.0), 2);
            $totalDelivery += $g['delivery_fee'];
            $firstShop = false;
        }
        unset($g);

        // Per-shop GST from each item's vendor-category gst_rate (BUG-014).
        // Default rate 0 → no GST until an admin sets a rate, so this is dormant
        // by default and independent of the delivery-fee math above. Like the
        // delivery fee, GST is platform-collected and excluded from the vendor's
        // sale credit / commission (which stay on $g['subtotal']).
        $gstRates = \App\Services\GstService::ratesForProducts($products);
        $totalGst = 0.0;
        foreach ($groups as $vk => &$g) {
            $gst = 0.0;
            foreach ($g['lines'] as $ln) {
                $gst += \App\Services\GstService::lineGst((float) $ln['price'] * (int) $ln['row']['qty'], $gstRates[(int) $ln['product']['id']] ?? 0.0);
            }
            $g['gst'] = round($gst, 2);
            $totalGst += $g['gst'];
        }
        unset($g);

        $grandTotal = $total + $totalDelivery + $totalGst;

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

        // Create one order per vendor group. Each gets its own delivery fee and
        // (for wallet) its own 90% vendor credit. The customer pays once below.
        $orderModel = new OrderModel();
        $itemModel  = new OrderItemModel();
        $tokenSvc   = new TokenService();
        $wallet     = new WalletService();
        $orderIds   = [];

        foreach ($groups as $vk => &$g) {
            // Prescription only on the sub-order(s) that actually carry a medical item.
            $rxPath = ($prescriptionRequired && PrescriptionPolicy::requiresFor($g['products'])) ? ($prescriptionPath ?: null) : null;
            $orderId = $orderModel->insert([
                'customer_id'       => $auth->id,
                'vendor_id'         => $vk ?: null,
                'total'             => $g['subtotal'] + $g['delivery_fee'] + ($g['gst'] ?? 0),
                'delivery_fee'      => $g['delivery_fee'],
                'delivery_minutes'  => $deliveryMinutes,
                'delivery_at'       => $deliveryAtSql,
                'payment_method'    => $paymentMethod,
                // Wallet orders are prepaid (start 'confirmed'); COD stays 'pending' until delivered.
                'status'            => $paymentMethod === 'cod' ? 'pending' : 'confirmed',
                'notes'             => $notes ?: null,
                'delivery_address'  => $deliveryAddress,
                'prescription_path' => $rxPath,
            ], true);
            $g['order_id'] = (int) $orderId;
            $orderIds[]    = (int) $orderId;

            foreach ($g['lines'] as $ln) {
                $r = $ln['row']; $p = $ln['product']; $variant = $ln['variant']; $price = (float) $ln['price'];
                $itemModel->insert([
                    'order_id'        => $orderId,
                    'product_id'      => (int) $p['id'],
                    'variation_id'    => $variant ? (int) $variant['id'] : null,
                    'variation_label' => $variant['name'] ?? null,
                    'name'            => $p['name'],
                    'qty'             => (int) $r['qty'],
                    'price'           => $price,
                    'subtotal'        => $price * (int) $r['qty'],
                ]);
                if ($variant) {
                    (new ProductVariantModel())->update($variant['id'], ['stock' => max(0, (int) $variant['stock'] - (int) $r['qty'])]);
                } else {
                    (new ProductModel())->update((int) $p['id'], ['stock' => max(0, (int) $p['stock'] - (int) $r['qty'])]);
                }
            }

            // Vendor inventory tokens — deduct this shop's subtotal × commission_pct.
            // Never block the order; deduct what's available and move on.
            if ($vk) {
                try { $tokenSvc->consumeForOrder($vk, (float) $g['subtotal']); }
                catch (\Throwable $e) { log_message('error', 'Token consume skipped for order: ' . $e->getMessage()); }
            }

            // Wallet orders settle now: credit this vendor 90% of THEIR items
            // subtotal (delivery excluded; the 10% pool is distributed below).
            if ($paymentMethod === 'wallet' && $vk) {
                $poolPct     = CommissionService::poolPctForVendor($vk);
                $sharePct    = rtrim(rtrim(number_format(100 - $poolPct, 2, '.', ''), '0'), '.');
                $vendorShare = round((float) $g['subtotal'] * (1 - $poolPct / 100), 2);
                $wallet->credit($vk, 'wallet', $vendorShare, 'receive', 'order#' . $orderId, "Sale ({$sharePct}% of order)");
            }
        }
        unset($g);

        // Customer settlement happens ONCE for the whole checkout.
        if ($paymentMethod === 'wallet') {
            $users->update($auth->id, ['wallet_balance' => (float) $u['wallet_balance'] - $grandTotal]);
            (new WalletTransactionModel())->insert([
                'user_id'   => $auth->id,
                'amount'    => $grandTotal,
                'type'      => 'payment',
                'reference' => 'order#' . $orderIds[0],
                'notes'     => count($orderIds) > 1
                    ? ('Orders ' . implode(', ', array_map(static fn ($i) => '#' . $i, $orderIds)))
                    : ('Order #' . $orderIds[0]),
            ]);
            // Delivery fees + GST are platform-collected (logistics revenue / tax
            // to remit) → admin pool. Neither is vendor sale revenue.
            $platformCut = round($totalDelivery + $totalGst, 2);
            if ($platformCut > 0) {
                \Config\Database::connect()->table('system_pools')
                    ->where('pool_key', 'admin_wallet')
                    ->set('balance', "balance + {$platformCut}", false)
                    ->update();
            }
        }

        // Clear cart
        (new CartItemModel())->where('user_id', $auth->id)->delete();

        // Build the success response. Push it to the client NOW (before
        // notifications + commission cascade) so the customer doesn't wait
        // for FCM round-trips. The slow work happens after the response.
        $response = $this->ok([
            'order_id'    => $orderIds[0],
            'order_ids'   => $orderIds,
            'order_count' => count($orderIds),
        ], 'Order placed');
        $this->sendEarly($response);

        // Notify the customer once, then each vendor + all admins per sub-order
        // (slow — runs after the response). Commission/buyback fires per order.
        $svc        = new NotificationService();
        $commission = new CommissionService();
        try {
            $svc->sendTyped((int) $auth->id, 'order_created', $orderIds[0], '/orders', 'Order placed',
                count($orderIds) > 1 ? (count($orderIds) . " orders · ₹{$grandTotal}") : "Total ₹{$grandTotal}");
        } catch (\Throwable $e) {
            log_message('error', 'Order push failed: ' . $e->getMessage());
        }

        foreach ($groups as $vk => $g) {
            $oid   = (int) $g['order_id'];
            $gross = (float) ($g['subtotal'] + $g['delivery_fee']);
            try {
                if ($vk) {
                    $svc->sendTyped($vk, 'order_created', $oid, '/orders', 'New order', "Order #{$oid} — ₹{$gross}");
                    // Driver is assigned later, per-order, by the vendor on the
                    // Orders page — the driver is notified then (see setDriver()).
                }
                $svc->sendTypedToRole('admin', 'order_created', $oid, '/orders', 'New order', "Order #{$oid} — ₹{$gross}");
            } catch (\Throwable $e) {
                log_message('error', 'Order push failed: ' . $e->getMessage());
            }

            // Commission/buyback cascade — NON-COD only (placed 'paid'); on this
            // shop's items subtotal (delivery excluded). distributeForOrder is
            // idempotent. COD settles on delivery (setStatus).
            if ($paymentMethod !== 'cod') {
                $commission->distributeForOrder($oid, (int) $auth->id, (float) $g['subtotal'], $vk ?: null);
            }
        }

        return $response;
    }

    /**
     * Customer: upload a prescription file (image or PDF) for medical-category
     * items, ahead of placing the order. Returns the stored relative path +
     * URL; the path is sent back with /orders/place. Mirrors the KYC upload
     * but allows PDF and stores under public/uploads/prescriptions/.
     */
    public function uploadPrescription(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        /** @var UploadedFile|null $file */
        $file = $this->request->getFile('file');
        if (! $file || ! $file->isValid() || $file->hasMoved()) return $this->fail('No file uploaded', 422);
        if ($file->getSize() > 5 * 1024 * 1024) return $this->fail('File must be 5 MB or smaller', 422);
        if (! in_array($file->getMimeType(), ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], true)) {
            return $this->fail('Prescription must be a JPG, PNG, WEBP or PDF', 422);
        }

        $dir = FCPATH . 'uploads/prescriptions/';
        if (! is_dir($dir)) @mkdir($dir, 0775, true);
        $name = $file->getRandomName();
        $file->move($dir, $name);
        $path = 'uploads/prescriptions/' . $name;

        return $this->ok(['path' => $path, 'url' => base_url($path)], 'Uploaded');
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
                    dr.name       AS driver_name,
                    (SELECT GROUP_CONCAT(NULLIF(oi.name, \'Item\') ORDER BY oi.id SEPARATOR \', \') FROM order_items oi WHERE oi.order_id = o.id) AS product_names
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

        // Return + cancel eligibility per order (global window settings + any open request).
        $svc         = new SystemSettingsService();
        $days        = (int) $svc->get('returns.window_days', '0');
        $cancelHours = (int) $svc->get('cancel.window_hours', '24');
        $orderIds = array_map(static fn ($r) => (int) $r['id'], $rows);
        $requested = [];
        $retStatus = [];
        if ($orderIds) {
            $rr = $db->table('order_returns')->select('order_id, status')
                ->whereIn('order_id', $orderIds)->orderBy('id', 'ASC')
                ->get()->getResultArray();
            foreach ($rr as $r) {
                $oid = (int) $r['order_id'];
                $retStatus[$oid] = $r['status'];                   // latest row wins (id ASC)
                if ($r['status'] !== 'rejected') $requested[$oid] = true;
            }
        }
        foreach ($rows as &$row) {
            $oid = (int) $row['id'];
            $row = array_merge(
                $row,
                $this->returnInfo($row, $days, isset($requested[$oid])),
                $this->cancelInfo($row, $cancelHours),
                ['return_status' => $retStatus[$oid] ?? null]
            );
        }
        unset($row);

        return $this->ok(['items' => $rows]);
    }

    /**
     * Return eligibility for one order given the global window (days).
     *   return_window_days    — the admin setting (0 = returns disabled)
     *   return_eligible_until — delivered_at + window ('Y-m-d H:i:s') or null
     *   can_return            — delivered, window>0, now <= until, no open request
     *   return_requested      — a non-rejected return already exists
     */
    private function returnInfo(array $order, int $windowDays, bool $hasRequest): array
    {
        $deliveredAt = $order['delivered_at'] ?? null;
        $until = null; $canReturn = false;
        // Returnable from delivery until the vendor marks the order 'completed'
        // (force-complete) or the window lapses — spans the delivered + paid steps.
        if ($windowDays > 0 && ! empty($deliveredAt) && ! in_array($order['status'] ?? '', ['completed', 'cancelled'], true)) {
            $ts        = strtotime($deliveredAt . ' +' . $windowDays . ' days');
            $until     = date('Y-m-d H:i:s', $ts);
            $canReturn = ! $hasRequest && time() <= $ts;
        }
        return [
            'return_window_days'    => $windowDays,
            'return_eligible_until' => $until,
            'can_return'            => $canReturn,
            'return_requested'      => $hasRequest,
        ];
    }

    /**
     * Cancellation eligibility for one order given the window (hours). Only
     * un-settled COD orders (status 'pending') qualify — wallet orders settle at
     * placement and go through Return instead.
     *   cancel_window_hours   — the admin setting (0 = cancellation disabled)
     *   cancel_eligible_until — created_at + window ('Y-m-d H:i:s') or null
     *   can_cancel            — pending, window>0, now <= until
     */
    private function cancelInfo(array $order, int $windowHours): array
    {
        $until = null; $canCancel = false;
        // Cancellable only while pending AND before a driver is assigned.
        if ($windowHours > 0 && ($order['status'] ?? '') === 'pending' && empty($order['driver_id']) && ! empty($order['created_at'])) {
            $ts        = strtotime($order['created_at'] . ' +' . $windowHours . ' hours');
            $until     = date('Y-m-d H:i:s', $ts);
            $canCancel = time() <= $ts;
        }
        return [
            'cancel_window_hours'   => $windowHours,
            'cancel_eligible_until' => $until,
            'can_cancel'            => $canCancel,
        ];
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
        // Enrich each line with the product image + a real display name
        // (legacy rows are stored as name='Item' but still link a product /
        // variant) + the variant label, so the customer sees an e-commerce
        // style item list. Variant images carry a '<->' suffix — strip it.
        // vendor_shop is resolved per item from the product's own vendor, so a
        // multi-vendor order (orders.vendor_id is null) still shows each item's
        // shop. shop_name wins; fall back to the vendor user's name.
        $items = \Config\Database::connect()->query(
            "SELECT oi.*,
                    COALESCE(NULLIF(oi.name, 'Item'), pv.name, p.name, 'Item')              AS display_name,
                    COALESCE(NULLIF(p.image, ''), SUBSTRING_INDEX(NULLIF(pv.image, ''), '<->', 1)) AS product_image,
                    pv.name AS variant_name,
                    COALESCE(NULLIF(ivp.shop_name, ''), iu.name) AS vendor_shop
             FROM order_items oi
             LEFT JOIN products p          ON p.id  = oi.product_id
             LEFT JOIN product_variants pv ON pv.id = oi.variation_id
             LEFT JOIN users iu            ON iu.id = p.vendor_id
             LEFT JOIN vendor_profiles ivp ON ivp.user_id = p.vendor_id
             WHERE oi.order_id = ?
             ORDER BY oi.id",
            [$id]
        )->getResultArray();

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

        // Return + cancel eligibility (same shape as mine()) so the detail view can show it.
        $svc    = new SystemSettingsService();
        $days      = (int) $svc->get('returns.window_days', '0');
        $latestRet = (new OrderReturnModel())->where('order_id', $id)->orderBy('id', 'DESC')->first();
        $retStatus = $latestRet['status'] ?? null;
        $hasReq    = $retStatus !== null && $retStatus !== 'rejected';
        $order  = array_merge(
            $order,
            $this->returnInfo($order, $days, $hasReq),
            $this->cancelInfo($order, (int) $svc->get('cancel.window_hours', '24')),
            [
                'return_status'    => $retStatus,
                // Prescription attached at checkout for medical orders (raw path
                // kept too; the frontend builds the display URL from it).
                'prescription_url' => ! empty($order['prescription_path']) ? base_url($order['prescription_path']) : null,
            ]
        );

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
        // Vendor-entered "Customer purchase" rows: OFFLINE entries are standalone
        // in-store sales with no other record, so they DO belong in the orders list.
        // ONLINE entries (and legacy untagged ones) instead mark the customer's real
        // order paid — that real order already shows here — so hide those to avoid
        // double-counting revenue.
        $where[] = "NOT (COALESCE(o.notes,'') LIKE 'In-store purchase (vendor-entered)%' AND COALESCE(o.sale_mode,'') <> 'offline')";
        $whereSql = implode(' AND ', $where);

        $total = (int) ($db->query("SELECT COUNT(*) AS c FROM orders o WHERE $whereSql", $params)->getRow()->c ?? 0);

        $rows = $db->query(
            "SELECT o.id, o.customer_id, o.vendor_id, o.driver_id, o.total, o.status, o.notes, o.created_at,
                    cu.name AS customer_name,
                    ve.name AS vendor_name,
                    vp.shop_name AS shop_name,
                    dr.name AS driver_name,
                    (SELECT COALESCE(SUM(qty),0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
                    (SELECT GROUP_CONCAT(NULLIF(oi.name, 'Item') ORDER BY oi.id SEPARATOR ', ') FROM order_items oi WHERE oi.order_id = o.id) AS product_names
             FROM orders o
             LEFT JOIN users cu            ON cu.id = o.customer_id
             LEFT JOIN users ve            ON ve.id = o.vendor_id
             LEFT JOIN users dr            ON dr.id = o.driver_id
             LEFT JOIN vendor_profiles vp  ON vp.user_id = o.vendor_id
             WHERE $whereSql
             ORDER BY o.id DESC
             LIMIT {$p['perPage']} OFFSET {$p['offset']}",
            $params
        )->getResultArray();

        return $this->ok(['items' => $rows, 'total' => $total, 'page' => $p['page'], 'per_page' => $p['perPage']]);
    }

    /**
     * Vendor / admin: assign (or clear) the delivery driver for one order.
     * Per-order assignment — a driver busy on another active order (anything
     * not delivered/cancelled) can't be picked. Sending an empty driver_id
     * unassigns the order. The chosen driver must live in the order's taluk.
     */
    public function setDriver(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, ['vendor', 'admin'], true)) return $this->fail('Forbidden', 403);
        if (! $this->validate(['driver_id' => 'permit_empty|is_natural'])) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }

        $model = new OrderModel();
        $order = $model->find($id);
        if (! $order) return $this->fail('Not found', 404);
        if ($auth->role === 'vendor' && (int) ($order['vendor_id'] ?? 0) !== (int) $auth->id) {
            return $this->fail('Forbidden', 403);
        }

        // A finished order never enters the driver's delivery queue, so changing
        // its driver is meaningless and only fires a misleading "assigned to you"
        // notification — block it.
        if (in_array($order['status'] ?? '', ['delivered', 'paid', 'completed', 'cancelled'], true)) {
            return $this->fail('This order is already ' . $order['status'] . ' — its driver can\'t be changed', 422);
        }

        $d        = $this->request->getJSON(true) ?? $this->request->getPost();
        $driverId = (isset($d['driver_id']) && $d['driver_id']) ? (int) $d['driver_id'] : null;

        // Unassign
        if (! $driverId) {
            $model->update($id, ['driver_id' => null]);
            return $this->ok(null, 'Driver unassigned');
        }

        $users  = new UserModel();
        $driver = $users->find($driverId);
        if (! $driver || $driver['role'] !== 'driver') return $this->fail('Driver not found', 404);

        // Driver must belong to the order's vendor's taluk.
        $vendorTaluk = $this->vendorTalukId((int) ($order['vendor_id'] ?? 0));
        if (! $vendorTaluk || (int) ($driver['taluk_id'] ?? 0) !== $vendorTaluk) {
            return $this->fail('Driver is not in this order\'s area', 422);
        }

        // A driver may hold multiple orders at once — no "busy" restriction.
        // (Still scoped to the order's taluk via the area check above.)
        $model->update($id, ['driver_id' => $driverId]);

        try {
            (new NotificationService())->sendTyped(
                $driverId, 'driver_assigned', $id, '/driver/orders',
                'New delivery assigned',
                "Order #{$id} — ₹{$order['total']} is assigned to you."
            );
        } catch (\Throwable $e) {
            log_message('error', 'Order driver assign push failed: ' . $e->getMessage());
        }

        return $this->ok(null, 'Driver assigned');
    }

    /** Taluk id for a vendor (via their vendor profile). 0 when unknown. */
    private function vendorTalukId(int $vendorId): int
    {
        if (! $vendorId) return 0;
        $vp = (new VendorProfileModel())->where('user_id', $vendorId)->first();
        return $vp && ! empty($vp['taluk_id']) ? (int) $vp['taluk_id'] : 0;
    }

    /**
     * Driver scans the shop's QR at pickup. The scanned value is the vendor's
     * mobile — verify it matches THIS order's vendor (right shop), then advance
     * the order to 'shipped' (out for delivery), syncing vendor + customer.
     * After this the driver's "Mark delivered" becomes available.
     */
    public function driverPickup(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'driver') return $this->fail('Forbidden', 403);

        $order = (new OrderModel())->find($id);
        if (! $order) return $this->fail('Not found', 404);
        if ((int) ($order['driver_id'] ?? 0) !== (int) $auth->id) {
            return $this->fail('This order is not assigned to you', 403);
        }

        $rank = ['pending' => 0, 'confirmed' => 1, 'packed' => 2, 'shipped' => 3, 'delivered' => 4, 'paid' => 5, 'completed' => 6];
        if (($rank[$order['status'] ?? 'pending'] ?? 0) >= $rank['shipped']) {
            return $this->fail('Order already picked up', 409);
        }

        $vendor = ! empty($order['vendor_id']) ? (new UserModel())->find((int) $order['vendor_id']) : null;
        if (! $vendor) return $this->fail('Order has no vendor to pick up from', 422);

        $d       = $this->request->getJSON(true) ?? $this->request->getPost() ?? [];
        $scanned = substr(preg_replace('/\D/', '', (string) ($d['vendor_mobile'] ?? '')), -10);
        $shop    = substr(preg_replace('/\D/', '', (string) ($vendor['mobile_number'] ?? '')), -10);
        if ($scanned === '' || $scanned !== $shop) {
            return $this->fail("Wrong QR — scan the shop's QR for order #{$id}", 422);
        }

        (new OrderModel())->update($id, ['status' => 'shipped']);

        try {
            $svc = new NotificationService();
            $svc->sendTyped((int) $vendor['id'], 'order_update', $id, '/orders', 'Order picked up',
                "Driver picked up order #{$id} — now out for delivery.");
            $svc->sendTyped((int) $order['customer_id'], 'order_update', $id, '/orders', 'Out for delivery',
                "Order #{$id} is out for delivery.");
        } catch (\Throwable $e) {
            log_message('error', 'Driver pickup notify failed: ' . $e->getMessage());
        }

        return $this->ok(null, 'Picked up — out for delivery');
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

        // Per-order assignment: the driver delivers exactly the orders the vendor
        // assigned to them (orders.driver_id = me), not the whole vendor's queue.
        // Deliverable = COD awaiting delivery (pending) + wallet orders (paid/
        // shipped). Legacy-imported orders are excluded — handled on the old site.
        $db = \Config\Database::connect();
        $legacyIds = [];
        if ($db->tableExists('legacy_id_map')) {
            foreach ($db->table('legacy_id_map')->select('new_id')->where('old_table', 'order')->get()->getResultArray() as $r) {
                $legacyIds[] = (int) $r['new_id'];
            }
        }
        $builder = (new OrderModel())
            ->where('driver_id', (int) $auth->id)
            ->whereIn('status', ['pending', 'confirmed', 'packed', 'shipped']);
        if ($legacyIds) $builder->whereNotIn('id', $legacyIds);
        $orders = $builder->orderBy('id', 'DESC')->findAll(200);
        if (! $orders) return $this->ok(['items' => []]);

        // Assigned orders can span multiple vendors → resolve each order's pickup
        // from its own vendor. Batch-load vendor names + profiles.
        $vendorIds = array_values(array_unique(array_filter(array_map(static fn ($o) => (int) ($o['vendor_id'] ?? 0), $orders))));
        $vendorById = []; $profileById = [];
        if ($vendorIds) {
            foreach ($users->whereIn('id', $vendorIds)->findAll() as $v) $vendorById[(int) $v['id']] = $v;
            foreach ((new VendorProfileModel())->whereIn('user_id', $vendorIds)->findAll() as $vp) $profileById[(int) $vp['user_id']] = $vp;
        }

        // Customer details for drops
        $custIds = array_values(array_unique(array_map(static fn ($o) => (int) $o['customer_id'], $orders)));
        $customers = $custIds ? $users->whereIn('id', $custIds)->findAll() : [];
        $byId = [];
        foreach ($customers as $c) $byId[(int) $c['id']] = $c;

        // Line items per order (name + image + qty + price) so the driver sees
        // exactly what to deliver. Same display-name/image resolution as show().
        $orderIds = array_map(static fn ($o) => (int) $o['id'], $orders);
        $linesByOrder = [];
        if ($orderIds) {
            $ph   = implode(',', array_fill(0, count($orderIds), '?'));
            $rows = $db->query(
                "SELECT oi.order_id, oi.id, oi.qty, oi.price,
                        COALESCE(NULLIF(oi.name, 'Item'), pv.name, p.name, 'Item') AS display_name,
                        COALESCE(NULLIF(p.image, ''), SUBSTRING_INDEX(NULLIF(pv.image, ''), '<->', 1)) AS product_image,
                        pv.name AS variant_name
                 FROM order_items oi
                 LEFT JOIN products p          ON p.id  = oi.product_id
                 LEFT JOIN product_variants pv ON pv.id = oi.variation_id
                 WHERE oi.order_id IN ($ph)
                 ORDER BY oi.id",
                $orderIds
            )->getResultArray();
            foreach ($rows as $r) {
                $linesByOrder[(int) $r['order_id']][] = [
                    'id'           => (int) $r['id'],
                    'name'         => $r['display_name'],
                    'variant_name' => $r['variant_name'],
                    'image'        => $r['product_image'],
                    'qty'          => (int) $r['qty'],
                    'price'        => (float) $r['price'],
                ];
            }
        }

        $items = [];
        foreach ($orders as $o) {
            $c   = $byId[(int) $o['customer_id']] ?? null;
            $vid = (int) ($o['vendor_id'] ?? 0);
            $vp  = $profileById[$vid] ?? [];
            $pickup = trim(implode(', ', array_filter([
                $vp['shop_name'] ?? null,
                $vp['address']   ?? null,
                $vp['area']      ?? null,
                $vp['pincode']   ?? null,
            ])));
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
                'delivery_fee'    => (float) ($o['delivery_fee'] ?? 0),
                'pickup_address'  => $pickup ?: ($vendorById[$vid]['name'] ?? 'Vendor'),
                'vendor_mobile'   => $vendorById[$vid]['mobile_number'] ?? '',
                'drop_address'    => $drop ?: 'Customer',
                'customer_name'   => $c['name']          ?? '',
                'customer_mobile' => $c['mobile_number'] ?? '',
                'created_at'      => $o['created_at'] ?? null,
                'items'           => $linesByOrder[(int) $o['id']] ?? [],
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
        if (! in_array($status, ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'paid', 'completed', 'cancelled'], true)) {
            return $this->fail('Invalid status', 422);
        }

        $model = new OrderModel();
        $order = $model->find($id);
        if (! $order) return $this->fail('Not found', 404);
        if ($auth->role === 'vendor' && (int) ($order['vendor_id'] ?? 0) !== (int) $auth->id) return $this->fail('Forbidden', 403);
        if ($auth->role === 'driver') {
            // Per-order assignment: a driver may only act on the order assigned to them.
            if ((int) ($order['driver_id'] ?? 0) !== (int) $auth->id) {
                return $this->fail('Forbidden', 403);
            }
            if ($status !== 'delivered') return $this->fail('Drivers can only mark delivered', 403);
        }

        // Forward-only fulfillment chain — status can't move backward (this is what
        // used to rewind the customer stepper, e.g. marking 'paid' after 'delivered').
        $cur  = (string) ($order['status'] ?? '');
        $rank = ['pending' => 0, 'confirmed' => 1, 'packed' => 2, 'shipped' => 3, 'delivered' => 4, 'paid' => 5, 'completed' => 6];
        if ($status === 'cancelled') {
            if (isset($rank[$cur]) && $rank[$cur] >= $rank['delivered']) {
                return $this->fail('A delivered order can no longer be cancelled', 422);
            }
        } elseif (isset($rank[$status], $rank[$cur]) && $rank[$status] < $rank[$cur]) {
            return $this->fail('Order status can only move forward', 422);
        }
        // COD payment + completion come only AFTER delivery (delivered_at is stamped then).
        if (in_array($status, ['paid', 'completed'], true) && empty($order['delivered_at'])) {
            return $this->fail('Mark the order delivered first', 422);
        }

        $patch = ['status' => $status];
        // Record which driver handled the order so the customer can see who delivered it.
        if ($auth->role === 'driver') $patch['driver_id'] = (int) $auth->id;
        // Stamp the delivery time on the first transition to delivered — the return
        // window (admin setting returns.window_days) is measured from this.
        if ($status === 'delivered' && ($order['status'] ?? '') !== 'delivered' && empty($order['delivered_at'])) {
            $patch['delivered_at'] = date('Y-m-d H:i:s');
        }
        $model->update($id, $patch);

        // Non-COD orders settle commission/buyback the moment they reach 'paid'
        // (covers orders that become paid after placement). COD settles on
        // delivery (below). Idempotent via commission_distributed_at; legacy skipped.
        if ($status === 'paid'
            && ($order['status'] ?? '') !== 'paid'
            && ($order['payment_method'] ?? '') !== 'cod'
            && ! $this->isLegacyOrder($id)) {
            (new CommissionService())->distributeForOrder(
                $id,
                (int) $order['customer_id'],
                (float) $order['total'],
                ! empty($order['vendor_id']) ? (int) $order['vendor_id'] : null,
            );
        }

        // COD on delivery does NOTHING financial: the cash is collected in person
        // (driver-collected / reconciled), so the vendor's wallet is NOT credited
        // and no commission is distributed. The MLM / buyback pool is funded only
        // by wallet-paid orders (settled at 'paid'). COD delivery just marks the
        // order delivered (status + delivered_at already set above).

        try {
            (new NotificationService())->sendTyped((int) $order['customer_id'], 'order_update', $id, '/orders', "Order #{$id}", "Status updated to {$status}");
        } catch (\Throwable $e) {
            log_message('error', 'Order status push failed: ' . $e->getMessage());
        }

        // When the order is marked ready ('shipped'), ping the driver assigned to
        // this order that it's ready to pick up. Guarded to fire only on the first
        // transition into 'shipped'.
        if ($status === 'shipped' && ($order['status'] ?? '') !== 'shipped') {
            try {
                $drvId = (int) ($order['driver_id'] ?? 0);
                if ($drvId) {
                    (new NotificationService())->sendTyped(
                        $drvId, 'order_created', $id, '/driver/orders',
                        'Ready to pick up', "Order #{$id} — ₹{$order['total']} is ready to deliver"
                    );
                }
            } catch (\Throwable $e) {
                log_message('error', 'Order shipped driver push failed: ' . $e->getMessage());
            }
        }
        return $this->ok(null, 'Updated');
    }

    /** Customer: request a return for a delivered order, within the return window. */
    public function requestReturn(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $order = (new OrderModel())->find($id);
        if (! $order) return $this->fail('Not found', 404);
        if ((int) $order['customer_id'] !== (int) $auth->id) return $this->fail('Forbidden', 403);
        // Returnable once delivered, until the vendor marks it 'completed'.
        if (empty($order['delivered_at']) || in_array($order['status'] ?? '', ['completed', 'cancelled'], true)) {
            return $this->fail('Only delivered orders (before completion) can be returned', 422);
        }

        $days = (int) (new SystemSettingsService())->get('returns.window_days', '0');
        if ($days <= 0) return $this->fail('Returns are disabled', 422);
        if (time() > strtotime($order['delivered_at'] . ' +' . $days . ' days')) {
            return $this->fail('Return window has closed', 422);
        }

        $rrm = new OrderReturnModel();
        if ($rrm->where('order_id', $id)->where('status !=', 'rejected')->countAllResults() > 0) {
            return $this->fail('A return request already exists for this order', 409);
        }

        $d      = $this->request->getJSON(true) ?? $this->request->getPost() ?? [];
        $reason = trim((string) ($d['reason'] ?? ''));
        if ($reason === '') return $this->fail('A return reason is required', 422);
        $rrm->insert([
            'order_id'    => $id,
            'customer_id' => (int) $auth->id,
            'reason'      => mb_substr($reason, 0, 255),
            'status'      => 'pending',
        ]);

        try {
            (new NotificationService())->sendTypedToRole('admin', 'order_update', $id, '/orders', 'Return requested', "Order #{$id} — a customer requested a return");
        } catch (\Throwable $e) {
            log_message('error', 'Return request admin notify failed: ' . $e->getMessage());
        }

        return $this->ok(null, 'Return requested');
    }

    /**
     * Customer: cancel an un-settled order (COD awaiting delivery, status
     * 'pending'). Restores inventory, charges a wallet penalty when the reason
     * isn't one of the admin's valid reasons, and notifies vendor + admin.
     * Wallet orders settle at placement → they must use Return instead.
     */
    public function cancel(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $om    = new OrderModel();
        $order = $om->find($id);
        if (! $order) return $this->fail('Not found', 404);
        if ((int) $order['customer_id'] !== (int) $auth->id) return $this->fail('Forbidden', 403);

        // Only un-settled orders qualify. COD orders are 'pending' until delivered;
        // wallet orders settle (vendor + commission paid) at placement → 'paid'.
        if (($order['status'] ?? '') !== 'pending') {
            return $this->fail(($order['status'] ?? '') === 'delivered'
                ? 'Delivered orders can only be returned, not cancelled'
                : 'This order can no longer be cancelled', 422);
        }
        // Once a driver is assigned the order is on its way; no more cancelling.
        if (! empty($order['driver_id'])) {
            return $this->fail('A driver is already assigned, so this order can no longer be cancelled', 422);
        }

        $svc   = new SystemSettingsService();
        $hours = (int) $svc->get('cancel.window_hours', '24');
        if ($hours <= 0) return $this->fail('Cancellation is disabled', 422);
        if (! empty($order['created_at']) && time() > strtotime($order['created_at'] . ' +' . $hours . ' hours')) {
            return $this->fail('Cancellation window has closed', 422);
        }

        $d      = $this->request->getJSON(true) ?? $this->request->getPost() ?? [];
        $reason = trim((string) ($d['reason'] ?? ''));

        // Penalty applies when the reason doesn't match any admin-configured valid
        // reason (comma-separated). An empty list = cancellations never penalised.
        $valids  = array_values(array_filter(array_map('trim', explode(',', (string) $svc->get('cancel.valid_reasons', '')))));
        $isValid = empty($valids);
        foreach ($valids as $vr) {
            if ($vr !== '' && $reason !== '' && mb_stripos($reason, $vr) !== false) { $isValid = true; break; }
        }
        $penalty = $isValid ? 0.0 : (float) $svc->get('cancel.penalty', '0');

        // Restore inventory for every line (mirror of the decrement in place()).
        $items = (new OrderItemModel())->where('order_id', $id)->findAll();
        foreach ($items as $it) {
            $qty = (int) $it['qty'];
            if ($qty <= 0) continue;
            if (! empty($it['variation_id'])) {
                $v = (new ProductVariantModel())->find((int) $it['variation_id']);
                if ($v) (new ProductVariantModel())->update((int) $v['id'], ['stock' => (int) $v['stock'] + $qty]);
            } elseif (! empty($it['product_id'])) {
                $p = (new ProductModel())->find((int) $it['product_id']);
                if ($p) (new ProductModel())->update((int) $p['id'], ['stock' => (int) $p['stock'] + $qty]);
            }
        }

        // Charge the penalty from the wallet, clamped to the available balance
        // (never blocks the cancellation, never goes negative).
        $charged = 0.0;
        if ($penalty > 0) {
            $u   = (new UserModel())->find((int) $auth->id);
            $bal = (float) ($u['wallet_balance'] ?? 0);
            $charged = round(min($penalty, $bal), 2);
            if ($charged > 0) {
                (new WalletService())->debit((int) $auth->id, 'wallet', $charged, 'penalty', 'order#' . $id, 'Cancellation penalty');
            }
        }

        $om->update($id, [
            'status'        => 'cancelled',
            'cancel_reason' => $reason !== '' ? mb_substr($reason, 0, 255) : null,
            'cancelled_at'  => date('Y-m-d H:i:s'),
            'penalty'       => $charged,
        ]);

        try {
            $n    = new NotificationService();
            $body = $charged > 0 ? "Order #{$id} cancelled. ₹{$charged} penalty applied." : "Order #{$id} cancelled.";
            $n->sendTyped((int) $auth->id, 'order_update', $id, '/orders', 'Order cancelled', $body);
            if (! empty($order['vendor_id'])) {
                $n->sendTyped((int) $order['vendor_id'], 'order_update', $id, '/orders', 'Order cancelled', "Order #{$id} was cancelled by the customer");
            }
            $n->sendTypedToRole('admin', 'order_update', $id, '/orders', 'Order cancelled', "Order #{$id} cancelled by customer");
        } catch (\Throwable $e) {
            log_message('error', 'cancel notify failed: ' . $e->getMessage());
        }

        return $this->ok(['penalty' => $charged], 'Order cancelled');
    }
}
