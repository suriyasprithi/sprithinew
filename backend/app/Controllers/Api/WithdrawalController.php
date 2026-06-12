<?php

namespace App\Controllers\Api;

use App\Models\UserModel;
use App\Models\WalletTransactionModel;
use App\Models\WithdrawalModel;
use App\Services\NotificationService;
use CodeIgniter\HTTP\ResponseInterface;

class WithdrawalController extends BaseApiController
{
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
        if ((float) ($u['wallet_balance'] ?? 0) < $amount) return $this->fail('Insufficient balance', 402);

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
        $rows = (new WithdrawalModel())->where('status', 'pending')->orderBy('id', 'DESC')->findAll();
        $userIds = array_unique(array_map(static fn ($r) => (int) $r['user_id'], $rows));
        $users   = $userIds ? (new UserModel())->whereIn('id', $userIds)->findAll() : [];
        $byId    = [];
        foreach ($users as $u) $byId[(int) $u['id']] = ['name' => $u['name'], 'mobile_number' => $u['mobile_number']];
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
        $bal = (float) ($u['wallet_balance'] ?? 0);
        if ($bal < (float) $row['amount']) return $this->fail('User has insufficient balance', 409);

        $users->update($row['user_id'], ['wallet_balance' => $bal - (float) $row['amount']]);
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
