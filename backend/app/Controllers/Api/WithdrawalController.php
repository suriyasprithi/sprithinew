<?php

namespace App\Controllers\Api;

use App\Models\UserModel;
use App\Models\WalletTransactionModel;
use App\Models\WithdrawalModel;
use App\Services\NotificationService;
use CodeIgniter\HTTP\ResponseInterface;

class WithdrawalController extends BaseApiController
{
    /** Minimum wallet balance state/district/taluk/vendor must keep — they may
     *  only withdraw the amount above this. Token operations ignore it. */
    private const MIN_WALLET = 2500.0;

    public function create(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        if (! $this->validate([
            'amount' => 'required|numeric|greater_than[0]',
            'method' => 'required|in_list[bank,upi]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $amount = (float) $d['amount'];

        $u = (new UserModel())->find($auth->id);

        // KYC must be verified before any withdrawal can be requested.
        if (($u['kyc_status'] ?? 'none') !== 'verified') {
            return $this->fail('Complete and get your KYC verified before withdrawing.', 403);
        }
        // State/district/taluk/vendor must keep a ₹2,500 minimum — they can only
        // withdraw above it. Token balance is spendable as ₹ (1 token = ₹1) so it
        // counts toward the withdrawable amount. Other roles have no floor.
        // (Token distribute/approve/accept is NOT limited by this minimum.)
        $combined = (float) ($u['token_balance'] ?? 0) + (float) ($u['wallet_balance'] ?? 0);
        $floor    = in_array($u['role'] ?? '', ['state', 'district', 'taluk', 'vendor'], true) ? self::MIN_WALLET : 0.0;
        $maxWithdrawable = max(0.0, $combined - $floor);
        if ($amount > $maxWithdrawable) {
            return $this->fail(
                $floor > 0
                    ? 'Keep a minimum balance of ₹' . number_format($floor, 0) . '. You can withdraw up to ₹' . number_format($maxWithdrawable, 2) . '.'
                    : 'Insufficient balance',
                402
            );
        }

        // Bank / UPI come from the verified KYC — snapshot them onto the request
        // so the admin sees exactly where the payout goes.
        $details = $d['method'] === 'upi'
            ? ['upi' => $u['upi'] ?? '']
            : [
                'account_holder' => $u['account_holder'] ?? $u['name'],
                'account_number' => $u['account_number'] ?? '',
                'ifsc'           => $u['ifsc_code'] ?? '',
                'bank_name'      => $u['bank_name'] ?? '',
            ];

        $id = (new WithdrawalModel())->insert([
            'user_id'      => $auth->id,
            'amount'       => $amount,
            'method'       => $d['method'],
            'details_json' => json_encode($details),
            'status'       => 'pending',
        ], true);

        // notify admins
        try {
            (new NotificationService())->sendTypedToRole(
                'admin', 'withdrawal_request', (int) $id, '/withdrawals',
                'New withdrawal', "₹{$amount} requested"
            );
        } catch (\Throwable $e) {
            log_message('error', 'Withdrawal request push failed: ' . $e->getMessage());
        }
        return $this->ok(['id' => (int) $id], 'Submitted');
    }

    public function mine(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        $rows = (new WithdrawalModel())->where('user_id', $auth->id)->orderBy('id', 'DESC')->findAll(100);
        return $this->ok(['items' => $rows]);
    }

    public function pending(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        // All withdrawals (not just pending) so the admin list shows history +
        // accurate stat cards; the UI filters by status client-side. Each row
        // carries details_json (the bank/UPI snapshot) for the payout preview.
        $rows = (new WithdrawalModel())->orderBy('id', 'DESC')->findAll(300);
        $userIds = array_unique(array_map(static fn ($r) => (int) $r['user_id'], $rows));
        $users   = $userIds ? (new UserModel())->whereIn('id', $userIds)->findAll() : [];
        $byId    = [];
        foreach ($users as $u) $byId[(int) $u['id']] = [
            'name'          => $u['name'],
            'mobile_number' => $u['mobile_number'],
            'role'          => $u['role'] ?? null,
            'address'       => trim(implode(', ', array_filter([
                $u['address_line'] ?? null,
                $u['city']         ?? null,
                $u['pincode']      ?? null,
            ]))) ?: null,
        ];
        $items = array_map(static fn ($r) => $r + ['user' => $byId[(int) $r['user_id']] ?? ['name' => '?', 'mobile_number' => '?']], $rows);
        return $this->ok(['items' => $items]);
    }

    public function approve(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $auth = $this->authUser();
        $model = new WithdrawalModel();
        $row = $model->find($id);
        if (! $row) return $this->fail('Not found', 404);
        if ($row['status'] !== 'pending') return $this->fail('Already processed', 409);

        $users = new UserModel();
        $u = $users->find($row['user_id']);
        // Pay out of the wallet (₹) first, then the token balance (1 token = ₹1)
        // for any remainder — mirrors how the withdrawable amount was computed.
        $wb  = (float) ($u['wallet_balance'] ?? 0);
        $tb  = (float) ($u['token_balance'] ?? 0);
        $amt = (float) $row['amount'];
        if ($wb + $tb < $amt) return $this->fail('User has insufficient balance', 409);
        $fromWallet = min($wb, $amt);
        $fromToken  = round($amt - $fromWallet, 2);
        $users->update($row['user_id'], [
            'wallet_balance' => round($wb - $fromWallet, 2),
            'token_balance'  => round($tb - $fromToken, 2),
        ]);
        (new WalletTransactionModel())->insert([
            'user_id'   => (int) $row['user_id'],
            'amount'    => (float) $row['amount'],
            'type'      => 'withdraw',
            'reference' => 'wd#' . $id,
        ]);
        $model->update($id, ['status' => 'paid', 'processed_by' => $auth->id]);
        try {
            (new NotificationService())->sendTyped(
                (int) $row['user_id'], 'withdrawal_status', $id, '/wallet',
                'Withdrawal approved', '₹' . $row['amount']
            );
        } catch (\Throwable $e) {
            log_message('error', 'Withdrawal approve push failed: ' . $e->getMessage());
        }
        return $this->ok(null, 'Approved');
    }

    public function reject(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $auth = $this->authUser();
        $note = (string) ($this->request->getJSON(true)['notes'] ?? $this->request->getPost('notes') ?? '');
        $model = new WithdrawalModel();
        $row = $model->find($id);
        if (! $row) return $this->fail('Not found', 404);
        if ($row['status'] !== 'pending') return $this->fail('Already processed', 409);
        $model->update($id, ['status' => 'rejected', 'processed_by' => $auth->id, 'notes' => $note ?: null]);
        try {
            (new NotificationService())->sendTyped(
                (int) $row['user_id'], 'withdrawal_status', $id, '/wallet',
                'Withdrawal rejected', $note ?: 'Please contact support'
            );
        } catch (\Throwable $e) {
            log_message('error', 'Withdrawal reject push failed: ' . $e->getMessage());
        }
        return $this->ok(null, 'Rejected');
    }

    private function requireAdmin(): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'admin') return $this->fail('Forbidden', 403);
        return null;
    }
}
