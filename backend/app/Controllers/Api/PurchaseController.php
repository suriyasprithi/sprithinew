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

        if (! $this->validate([
            'customer_mobile' => 'required|regex_match[/^[0-9]{10}$/]',
            'amount'          => 'required|numeric|greater_than[0]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $users = new UserModel();
        $customer = $users->findByMobileAndRole($d['customer_mobile'], 'customer');
        if (! $customer) return $this->fail('Customer not found', 404);

        $amount = (float) $d['amount'];
        if ((float) ($customer['wallet_balance'] ?? 0) < $amount) return $this->fail('Customer has insufficient wallet balance', 402);

        $vendor = $users->find($auth->id);

        // Synthetic order record (no items)
        $orderId = (new OrderModel())->insert([
            'customer_id' => (int) $customer['id'],
            'vendor_id'   => (int) $auth->id,
            'total'       => $amount,
            'status'      => 'paid',
            'notes'       => 'In-store purchase (vendor-entered)',
        ], true);

        // Debit customer
        $users->update((int) $customer['id'], ['wallet_balance' => (float) $customer['wallet_balance'] - $amount]);
        (new WalletTransactionModel())->insert(['user_id' => (int) $customer['id'], 'peer_user_id' => (int) $auth->id, 'amount' => $amount, 'type' => 'payment', 'reference' => 'qr#' . $orderId, 'notes' => 'Vendor purchase']);

        // Credit the vendor their share — (100 − the vendor's commission %) — to
        // the MAIN wallet; only customer-scanned QR sales land in the QR wallet.
        // The remaining commission % is the pool distributed below.
        $poolPct     = CommissionService::poolPctForVendor((int) $auth->id);
        $sharePct    = rtrim(rtrim(number_format(100 - $poolPct, 2, '.', ''), '0'), '.');
        $vendorShare = round($amount * (1 - $poolPct / 100), 2);
        (new WalletService())->credit((int) $auth->id, 'wallet', $vendorShare, 'receive', 'order#' . $orderId, "Sale ({$sharePct}% of in-store purchase)");

        // 9-way commission pool distribution
        (new CommissionService())->distributeForOrder((int) $orderId, (int) $customer['id'], $amount, (int) $auth->id);

        $svc = new NotificationService();
        $svc->sendToUser((int) $customer['id'], 'Purchase complete', "₹{$amount} paid to {$vendor['name']}");
        $svc->sendToUser((int) $auth->id,       'New sale',          "₹{$amount} from {$customer['name']}");

        return $this->ok(['order_id' => (int) $orderId], 'Purchase complete');
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

        $rows = \Config\Database::connect()->query(
            "SELECT o.id, o.total, o.created_at,
                    cu.name AS customer_name, cu.mobile_number AS customer_mobile,
                    CASE WHEN o.notes LIKE '%vendor-entered%' THEN 'entered' ELSE 'qr' END AS source
             FROM orders o
             LEFT JOIN users cu ON cu.id = o.customer_id
             WHERE o.vendor_id = ? AND o.notes LIKE 'In-store purchase%'
             ORDER BY o.id DESC
             LIMIT 100",
            [(int) $auth->id]
        )->getResultArray();

        return $this->ok(['items' => $rows]);
    }
}
