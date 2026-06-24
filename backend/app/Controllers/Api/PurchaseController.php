<?php

namespace App\Controllers\Api;

use App\Models\OrderItemModel;
use App\Models\OrderModel;
use App\Models\UserModel;
use App\Models\WalletTransactionModel;
use App\Services\CommissionService;
use App\Services\NotificationService;
use App\Services\WalletService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * In-store/QR-based purchase: customer scans vendor's QR (which encodes vendor mobile_number),
 * enters amount, customer's wallet is debited, vendor's wallet credited, and the MLM commission cascade fires.
 */
class PurchaseController extends BaseApiController
{
    public function fromQr(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        if (! $this->validate([
            'vendor_mobile' => 'required|regex_match[/^[0-9]{10}$/]',
            'amount'        => 'required|numeric|greater_than[0]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $users = new UserModel();
        $vendor = $users->findByMobileAndRole($d['vendor_mobile'], 'vendor');
        if (! $vendor) return $this->fail('Vendor not found', 404);

        $amount = (float) $d['amount'];
        $buyer = $users->find($auth->id);
        if ((float) ($buyer['wallet_balance'] ?? 0) < $amount) return $this->fail('Insufficient wallet balance', 402);

        // Create a synthetic order record (no items)
        $orderId = (new OrderModel())->insert([
            'customer_id' => $auth->id,
            'vendor_id'   => (int) $vendor['id'],
            'total'       => $amount,
            'status'      => 'paid',
            'notes'       => 'In-store purchase via QR',
        ], true);

        // Debit buyer
        $users->update($auth->id, ['wallet_balance' => (float) $buyer['wallet_balance'] - $amount]);
        $tx = new WalletTransactionModel();
        $tx->insert(['user_id' => $auth->id, 'peer_user_id' => $vendor['id'], 'amount' => $amount, 'type' => 'payment', 'reference' => 'qr#' . $orderId, 'notes' => 'Vendor purchase']);

        // Credit the vendor their share — (100 − the vendor's commission %) — to
        // the QR wallet; the remaining commission % is the pool distributed below.
        // The same per-vendor % drives both, so the books reconcile.
        // The vendor later transfers from qr_wallet to their main wallet to spend/withdraw.
        $poolPct     = CommissionService::poolPctForVendor((int) $vendor['id']);
        $sharePct    = rtrim(rtrim(number_format(100 - $poolPct, 2, '.', ''), '0'), '.');
        $vendorShare = round((float) $amount * (1 - $poolPct / 100), 2);
        (new WalletService())->credit((int) $vendor['id'], 'qr', $vendorShare, 'receive', 'qr#' . $orderId, "Sale ({$sharePct}% of QR purchase)");

        // 9-way commission pool distribution (L1/L2/L3 + buyback x4 + global + admin)
        (new CommissionService())->distributeForOrder((int) $orderId, (int) $auth->id, $amount, (int) $vendor['id']);

        $svc = new NotificationService();
        $svc->sendToUser((int) $auth->id,        'Purchase complete', "₹{$amount} paid to {$vendor['name']}");
        $svc->sendToUser((int) $vendor['id'],    'New sale',         "₹{$amount} from {$buyer['name']}");

        return $this->ok(['order_id' => (int) $orderId], 'Purchase complete');
    }

    /**
     * Vendor-initiated counterpart of fromQr(): the vendor enters the customer's
     * mobile + amount instead of the customer scanning the vendor's QR. Same
     * economics — debit the customer's wallet, credit the vendor 90% to the QR
     * wallet, and run the MLM commission cascade.
     */
    public function fromCustomer(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'vendor') return $this->fail('Only vendors can charge a customer', 403);

        // sale_mode is permit_empty (defaults to 'offline' below) so an older
        // deployed customer-purchase form — which only posts mobile + amount —
        // keeps working instead of failing validation against this newer backend.
        if (! $this->validate([
            'customer_mobile' => 'required|regex_match[/^[0-9]{10}$/]',
            'amount'          => 'required|numeric|greater_than[0]',
            'sale_mode'       => 'permit_empty|in_list[online,offline]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $users = new UserModel();
        $customer = $users->findByMobileAndRole($d['customer_mobile'], 'customer');
        if (! $customer) return $this->fail('Customer not found', 404);

        $amount   = (float) $d['amount'];
        $saleMode = ($d['sale_mode'] ?? '') === 'online' ? 'online' : 'offline';
        // Optional free-text remark, kept for offline records.
        $note     = trim((string) ($d['note'] ?? ''));

        // ONLINE links one of the customer's real orders: the amount comes from
        // that order and the order is marked 'paid'. The commission below is then
        // charged to the vendor exactly like an offline sale.
        $linkOrderId = 0;
        $notes       = 'In-store purchase (vendor-entered)';
        if ($saleMode === 'online') {
            $linkOrderId = (int) ($d['order_id'] ?? 0);
            if ($linkOrderId <= 0) return $this->fail('Select an order for an online sale', 422);

            $orders = new OrderModel();
            $linked = $orders
                ->where('id', $linkOrderId)
                ->where('vendor_id', (int) $auth->id)
                ->where('customer_id', (int) $customer['id'])
                ->first();
            if (! $linked) return $this->fail('That order does not belong to this customer', 422);

            // Commission base = the linked order's items SUBTOTAL (delivery fee +
            // GST excluded), exactly as the placement/commission paths do — never
            // the gross order total and never the client value.
            $subtotal = (float) (\Config\Database::connect()
                ->table('order_items')->selectSum('subtotal')
                ->where('order_id', $linkOrderId)->get()->getRow()->subtotal ?? 0);
            $amount = $subtotal > 0
                ? $subtotal
                : max(0.0, (float) $linked['total'] - (float) ($linked['delivery_fee'] ?? 0));
            $notes .= ' · order #' . $linkOrderId;

            // Mark the real order paid (forward-only: only after delivery). If it
            // is already paid/completed we leave the status as-is.
            $cur = (string) ($linked['status'] ?? '');
            if (! in_array($cur, ['paid', 'completed'], true)) {
                if (empty($linked['delivered_at'])) {
                    return $this->fail('Mark the order delivered first', 422);
                }
                $orders->update($linkOrderId, ['status' => 'paid']);
            }
        } elseif ($note !== '') {
            $notes .= ' — ' . $note;
        }

        // Commission: the customer paid the vendor directly (cash in-store, or via
        // the linked online order), so the platform commission — the vendor's
        // commission_pct of the amount — is DEBITED from the vendor's main wallet
        // and distributed to the MLM uplines + admin pools. Require the vendor can
        // cover it first.
        $vendor    = $users->find($auth->id);
        $poolPct   = CommissionService::poolPctForVendor((int) $auth->id);
        $poolAmt   = round($amount * $poolPct / 100, 2);
        $poolLabel = rtrim(rtrim(number_format($poolPct, 2, '.', ''), '0'), '.');

        if ($poolAmt > 0 && (float) ($vendor['wallet_balance'] ?? 0) < $poolAmt) {
            return $this->fail("Insufficient main wallet balance to cover the {$poolLabel}% commission (₹{$poolAmt}).", 402);
        }

        // Hidden in-store record (no items) carrying this sale's commission. Its
        // 'In-store purchase (vendor-entered)' prefix keeps it OUT of the Orders
        // list (the listForRole filter hides it) while the Customer purchase page
        // lists it. Online rows also carry the linked order ref in the notes.
        $orderId = (new OrderModel())->insert([
            'customer_id' => (int) $customer['id'],
            'vendor_id'   => (int) $auth->id,
            'total'       => $amount,
            'status'      => 'paid',
            'sale_mode'   => $saleMode,
            'notes'       => $notes,
        ], true);

        if ($poolAmt > 0
            && ! (new WalletService())->debit((int) $auth->id, 'wallet', $poolAmt, 'commission', 'order#' . $orderId, "Commission ({$poolLabel}% of in-store sale)")) {
            // Debit failed (e.g. the balance was drained after the pre-check) —
            // roll back the hidden record and NEVER distribute money the vendor
            // didn't fund.
            (new OrderModel())->delete($orderId);
            return $this->fail("Insufficient main wallet balance to cover the {$poolLabel}% commission (₹{$poolAmt}).", 402);
        }

        (new CommissionService())->distributeForOrder((int) $orderId, (int) $customer['id'], $amount, (int) $auth->id);

        $svc = new NotificationService();
        if ($saleMode === 'online') {
            $svc->sendToUser((int) $customer['id'], 'Order marked paid', "Your order #{$linkOrderId} at {$vendor['name']} was marked paid.");
            $svc->sendToUser((int) $auth->id,       'Online sale recorded', "Order #{$linkOrderId} — {$poolLabel}% commission (₹{$poolAmt}) charged.");
            return $this->ok(['order_id' => (int) $orderId, 'linked_order_id' => $linkOrderId], 'Order marked paid');
        }
        $svc->sendToUser((int) $customer['id'], 'Purchase recorded', "Your ₹{$amount} purchase at {$vendor['name']} was recorded.");
        $svc->sendToUser((int) $auth->id,       'New sale',          "₹{$amount} from {$customer['name']}");

        return $this->ok(['order_id' => (int) $orderId], 'Purchase recorded');
    }

    /**
     * The current vendor's in-store / QR purchases (customer-scanned + vendor-
     * entered), most recent first. Shown under the vendor's QR on the scanner page.
     */
    public function mine(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'vendor') return $this->fail('Forbidden', 403);

        // In-store records — QR scans, plus the vendor-entered offline + online
        // customer purchases (all carry the 'In-store purchase' notes prefix).
        $rows = \Config\Database::connect()->query(
            "SELECT o.id, o.total, o.created_at, o.qr_transferred_at, o.sale_mode, o.notes,
                    cu.name AS customer_name, cu.mobile_number AS customer_mobile,
                    CASE WHEN o.notes LIKE '%vendor-entered%' THEN 'entered' ELSE 'qr' END AS source
             FROM orders o
             LEFT JOIN users cu ON cu.id = o.customer_id
             WHERE o.vendor_id = ? AND o.notes LIKE 'In-store purchase%'
             ORDER BY o.id DESC
             LIMIT 100",
            [(int) $auth->id]
        )->getResultArray();

        // The QR wallet holds the vendor's share (gross minus the commission
        // pool). Surface that share + whether the row was already moved to the
        // main wallet, so the QR scanner page can show a per-row Transfer button.
        $poolPct = CommissionService::poolPctForVendor((int) $auth->id);
        foreach ($rows as &$r) {
            $r['vendor_share'] = round((float) $r['total'] * (1 - $poolPct / 100), 2);
            $r['transferred']  = ! empty($r['qr_transferred_at']);
            // Parse the linked order ref (online) / remark (offline) out of notes.
            $notes = (string) ($r['notes'] ?? '');
            $r['linked_order_id'] = preg_match('/order #(\d+)/', $notes, $m) ? (int) $m[1] : null;
            $pos = strpos($notes, ' — ');
            $r['note'] = $pos !== false ? trim(substr($notes, $pos + strlen(' — '))) : '';
        }
        unset($r);

        return $this->ok(['items' => $rows]);
    }

    /**
     * Vendor: a customer's real orders (by mobile), used to link an ONLINE
     * customer-purchase record to the order it was for. Excludes the synthetic
     * in-store purchase rows so only genuine app orders are selectable.
     */
    public function customerOrders(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'vendor') return $this->fail('Forbidden', 403);

        $mobile = (string) ($this->request->getGet('mobile') ?? '');
        if (! preg_match('/^[0-9]{10}$/', $mobile)) return $this->fail('Enter a valid 10-digit mobile', 422);

        $customer = (new UserModel())->findByMobileAndRole($mobile, 'customer');
        if (! $customer) return $this->fail('Customer not found', 404);

        $rows = \Config\Database::connect()->query(
            "SELECT o.id, o.total, o.status, o.created_at
             FROM orders o
             WHERE o.vendor_id = ? AND o.customer_id = ?
                   AND COALESCE(o.notes,'') NOT LIKE 'In-store purchase%'
             ORDER BY o.id DESC
             LIMIT 100",
            [(int) $auth->id, (int) $customer['id']]
        )->getResultArray();

        return $this->ok(['items' => $rows]);
    }

    /**
     * Vendor: move one customer-scanned QR purchase's share from the QR wallet
     * to the main wallet. Per-row transfer — only the vendor's share (gross minus
     * the commission pool, i.e. what actually landed in the QR wallet) moves.
     * Blocks double-transfer via orders.qr_transferred_at.
     */
    public function transferOne(int $orderId): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'vendor') return $this->fail('Forbidden', 403);

        $orders = new OrderModel();
        $order  = $orders->find($orderId);
        if (! $order) return $this->fail('Not found', 404);
        if ((int) ($order['vendor_id'] ?? 0) !== (int) $auth->id) return $this->fail('Forbidden', 403);
        // Only customer-scanned QR purchases live in the QR wallet; vendor-entered
        // ones already credited the main wallet at sale time.
        if (($order['notes'] ?? '') !== 'In-store purchase via QR') {
            return $this->fail('This purchase is not a QR-wallet sale', 422);
        }
        if (! empty($order['qr_transferred_at'])) return $this->fail('Already transferred to main wallet', 409);

        $poolPct = CommissionService::poolPctForVendor((int) $auth->id);
        $share   = round((float) $order['total'] * (1 - $poolPct / 100), 2);
        if ($share <= 0) return $this->fail('Nothing to transfer', 422);

        if (! (new WalletService())->transfer((int) $auth->id, 'qr', 'wallet', $share)) {
            return $this->fail('QR wallet balance is too low to transfer this purchase', 422);
        }
        $orders->update($orderId, ['qr_transferred_at' => date('Y-m-d H:i:s')]);

        $bal = (new WalletService())->balances((int) $auth->id);
        return $this->ok([
            'transferred'    => $share,
            'qr_balance'     => $bal['qr']     ?? 0,
            'wallet_balance' => $bal['wallet'] ?? 0,
        ], 'Moved to main wallet');
    }
}
