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
            'vendor_mobile' => 'required|string|min_length[7]|max_length[15]',
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

        // Credit vendor 90% to the QR wallet — remaining 10% becomes the commission pool below.
        // The vendor later transfers from qr_wallet to their main wallet to spend/withdraw.
        $vendorShare = round((float) $amount * 0.90, 2);
        (new WalletService())->credit((int) $vendor['id'], 'qr', $vendorShare, 'receive', 'qr#' . $orderId, 'Sale (90% of QR purchase)');

        // 9-way commission pool distribution (L1/L2/L3 + buyback x4 + global + admin)
        (new CommissionService())->distributeForOrder((int) $orderId, (int) $auth->id, $amount, (int) $vendor['id']);

        $svc = new NotificationService();
        $svc->sendToUser((int) $auth->id,        'Purchase complete', "₹{$amount} paid to {$vendor['name']}");
        $svc->sendToUser((int) $vendor['id'],    'New sale',         "₹{$amount} from {$buyer['name']}");

        return $this->ok(['order_id' => (int) $orderId], 'Purchase complete');
    }
}
