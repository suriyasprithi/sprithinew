<?php

namespace App\Controllers\Api;

use App\Models\UserModel;
use App\Models\WalletTransactionModel;
use App\Models\StateModel;
use App\Models\DistrictModel;
use App\Models\TalukModel;
use CodeIgniter\HTTP\ResponseInterface;

class AdminUsersController extends BaseApiController
{
    public function customers(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $q = $this->request->getGet('q');
        $statusFilter = $this->request->getGet('status');
        $p = $this->paging(20);
        $model = (new UserModel())->where('role', 'customer');
        if ($q) {
            $model->groupStart()
                ->like('name', $q)->orLike('mobile_number', $q)
                ->orLike('email', $q)->orLike('pincode', $q);
            if (ctype_digit((string) $q)) { $model->orWhere('id', (int) $q); }
            $model->groupEnd();
        }
        if (in_array($statusFilter, ['active', 'blocked', 'inactive'], true)) {
            $model->where('status', $statusFilter);
        }
        $count = clone $model;
        $total = $count->countAllResults(false);
        $items = $model->orderBy('id', 'DESC')->findAll($p['perPage'], $p['offset']);

        $refMap = $this->referrerMap($items);

        // Global aggregates for the stat cards (independent of search/status filter).
        $agg = db_connect()->query(
            "SELECT COUNT(*) total, SUM(status='active') active,
                    SUM(status='inactive') inactive, SUM(status='blocked') blocked,
                    COALESCE(SUM(wallet_balance), 0) wallet_sum
             FROM users WHERE role = 'customer' AND deleted_at IS NULL"
        )->getRow();

        return $this->ok([
            'items'    => array_map(fn ($u) => $this->formatCustomer($u, $refMap), $items),
            'total'    => $total,
            'page'     => $p['page'],
            'per_page' => $p['perPage'],
            'stats'    => [
                'total'      => (int) $agg->total,
                'active'     => (int) $agg->active,
                'inactive'   => (int) $agg->inactive,
                'blocked'    => (int) $agg->blocked,
                'wallet_sum' => (float) $agg->wallet_sum,
            ],
        ]);
    }

    /** Full profile for one customer — geo names, lifetime orders and referrals. */
    public function show(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;

        $users = new UserModel();
        $u = $users->where('role', 'customer')->find($id);
        if (! $u) return $this->fail('Customer not found', 404);

        $base = $this->formatCustomer($u, $this->referrerMap([$u]));

        $stateName = $districtName = $talukName = null;
        if (! empty($u['state_id']))    { $s = (new StateModel())->find((int) $u['state_id']);    $stateName    = $s['name'] ?? null; }
        if (! empty($u['district_id'])) { $d = (new DistrictModel())->find((int) $u['district_id']); $districtName = $d['name'] ?? null; }
        if (! empty($u['taluk_id']))    { $t = (new TalukModel())->find((int) $u['taluk_id']);     $talukName    = $t['name'] ?? null; }

        $db = db_connect();
        $orders = $db->query(
            "SELECT COUNT(*) cnt, COALESCE(SUM(CASE WHEN status = 'delivered' THEN total ELSE 0 END), 0) spent
             FROM orders WHERE customer_id = ?",
            [$id]
        )->getRow();
        $referrals = (int) $db->query(
            "SELECT COUNT(*) cnt FROM users WHERE referrer_id = ? AND deleted_at IS NULL",
            [$id]
        )->getRow()->cnt;

        $fileUrl = static fn ($p) => $p ? base_url($p) : null;

        return $this->ok(array_merge($base, [
            'dob'             => $u['dob'] ?? null,
            'state_name'      => $stateName,
            'district_name'   => $districtName,
            'taluk_name'      => $talukName,
            'orders_count'    => (int) $orders->cnt,
            'orders_spent'    => (float) $orders->spent,
            'referrals_count' => $referrals,
            // KYC
            'kyc_status'        => $u['kyc_status'] ?? 'none',
            'kyc_note'          => $u['kyc_note'] ?? null,
            'aadhar'            => $u['aadhar'] ?? null,
            'pan'               => $u['pan'] ?? null,
            'aadhar_image_url'  => $fileUrl($u['aadhar_image'] ?? null),
            'pan_image_url'     => $fileUrl($u['pan_image'] ?? null),
            'bank_passbook_url' => $fileUrl($u['bank_passbook'] ?? null),
            // Bank
            'account_holder'    => $u['account_holder'] ?? null,
            'bank_name'         => $u['bank_name'] ?? null,
            'account_number'    => $u['account_number'] ?? null,
            'ifsc_code'         => $u['ifsc_code'] ?? null,
            'upi'               => $u['upi'] ?? null,
        ]));
    }

    /**
     * Admin creates a customer directly — no SMS OTP and no login tokens
     * (unlike public AuthController::register). Mirrors that insert otherwise.
     */
    public function create(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;

        if (! $this->validate([
            'name'          => 'required|string|min_length[2]|max_length[100]',
            'mobile_number' => 'required|regex_match[/^[0-9]{10}$/]',
            'password'      => 'required|string|min_length[6]|max_length[64]',
            'email'         => 'permit_empty|valid_email|max_length[150]',
            'pincode'       => 'permit_empty|regex_match[/^[0-9]{6}$/]',
            'dob'           => 'permit_empty|valid_date',
            'state_id'      => 'permit_empty|is_natural_no_zero',
            'district_id'   => 'permit_empty|is_natural_no_zero',
            'taluk_id'      => 'permit_empty|is_natural_no_zero',
            'referrer_code' => 'permit_empty|regex_match[/^[0-9]{10}$/]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $users = new UserModel();
        if ($users->mobileExistsForRole($d['mobile_number'], 'customer')) {
            return $this->fail('Mobile number already registered', 409);
        }

        // Link the referrer (by mobile). Admin-created customers get the SAME
        // referral benefits as a self-signup (welcome bonus + upline counts),
        // fired after insert below — only OTP is skipped here.
        $referrerId = null;
        if (! empty($d['referrer_code'])) {
            $ref = $users->where('mobile_number', $d['referrer_code'])
                ->where('role', 'customer')->where('status', 'active')->first();
            if ($ref) $referrerId = (int) $ref['id'];
        }

        $userId = $users->insert([
            'name'          => trim((string) $d['name']),
            'mobile_number' => trim((string) $d['mobile_number']),
            'email'         => ! empty($d['email']) ? trim((string) $d['email']) : null,
            'password_hash' => password_hash((string) $d['password'], PASSWORD_BCRYPT),
            'role'          => 'customer',
            'status'        => 'active',
            'pincode'       => ! empty($d['pincode']) ? trim((string) $d['pincode']) : null,
            'referrer_id'   => $referrerId,
            'dob'           => ! empty($d['dob']) ? $d['dob'] : null,
            'state_id'      => ! empty($d['state_id']) ? (int) $d['state_id'] : null,
            'district_id'   => ! empty($d['district_id']) ? (int) $d['district_id'] : null,
            'taluk_id'      => ! empty($d['taluk_id']) ? (int) $d['taluk_id'] : null,
        ], true);
        if (! $userId) return $this->fail('Could not create customer', 422, $users->errors());

        // Mirror the self-signup referral benefits (the account is created active):
        // attach to the referrer's 3-level upline chain (counts + referrals rows)
        // and award the welcome bonus. No OTP — admin creation never requires it.
        if ($referrerId) {
            (new \App\Services\ReferralChainService())->attach($referrerId, (int) $userId);
            (new \App\Services\WelcomeBonusService())->award($referrerId, (int) $userId);
        }

        $fresh  = $users->find($userId);
        return $this->ok($this->formatCustomer($fresh, $this->referrerMap([$fresh])), 'Customer created');
    }

    public function activate(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        (new UserModel())->update($id, ['status' => 'active']);
        return $this->ok(null, 'Activated');
    }

    public function deactivate(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        (new UserModel())->update($id, ['status' => 'inactive']);
        return $this->ok(null, 'Deactivated');
    }

    /** Admin edits a customer's core fields and optionally sets a new password. */
    public function update(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $model = new UserModel();
        $u = $model->find($id);
        if (! $u || $u['role'] !== 'customer') return $this->fail('Customer not found', 404);

        $d = $this->request->getJSON(true) ?? $this->request->getPost() ?? [];
        $data = [];
        foreach (['name', 'email', 'mobile_number', 'pincode'] as $f) {
            if (array_key_exists($f, $d)) {
                $data[$f] = is_string($d[$f]) ? trim($d[$f]) : $d[$f];
            }
        }
        $pw = (string) ($d['password'] ?? '');
        if ($pw !== '') {
            $data['password_hash']  = password_hash($pw, PASSWORD_BCRYPT);
            $data['legacy_password'] = null;
        }
        if (! $data) return $this->fail('Nothing to update', 422);

        if (! $model->update($id, $data)) {
            return $this->fail('Validation failed', 422, $model->errors());
        }

        $fresh  = $model->find($id);
        $refMap = $this->referrerMap([$fresh]);
        return $this->ok($this->formatCustomer($fresh, $refMap), 'Saved');
    }

    /** Admin adds to or deducts from a customer's main wallet, with an audit row. */
    public function wallet(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;

        if (! $this->validate([
            'amount'    => 'required|numeric|greater_than[0]',
            'direction' => 'required|in_list[credit,debit]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $amount    = (float) $d['amount'];
        $direction = $d['direction'];
        $notes     = trim((string) ($d['notes'] ?? ''));

        $model = new UserModel();
        $u = $model->find($id);
        if (! $u || $u['role'] !== 'customer') return $this->fail('Customer not found', 404);

        $bal = (float) ($u['wallet_balance'] ?? 0);
        if ($direction === 'debit' && $amount > $bal) {
            return $this->fail('Insufficient balance', 422);
        }
        $new = $direction === 'credit' ? $bal + $amount : $bal - $amount;
        $model->update($id, ['wallet_balance' => $new]);

        (new WalletTransactionModel())->insert([
            'user_id' => $id,
            'amount'  => $amount,
            'type'    => $direction === 'credit' ? 'admin_credit' : 'admin_debit',
            'notes'   => $notes ?: null,
        ]);

        return $this->ok(['wallet_balance' => $new], 'Wallet updated');
    }

    /** Maps referrer_id -> ['id','name','mobile_number'] for the given customer rows. */
    private function referrerMap(array $items): array
    {
        $refIds = array_values(array_unique(array_filter(
            array_map(static fn ($u) => $u['referrer_id'] ?? null, $items)
        )));
        $map = [];
        if ($refIds) {
            $refs = (new UserModel())->select('id, name, mobile_number')->whereIn('id', $refIds)->findAll();
            foreach ($refs as $r) { $map[(int) $r['id']] = $r; }
        }
        return $map;
    }

    private function formatCustomer(array $u, array $refMap): array
    {
        $refId = isset($u['referrer_id']) ? (int) $u['referrer_id'] : null;
        $ref   = $refId && isset($refMap[$refId]) ? $refMap[$refId] : null;
        return [
            'id'              => (int) $u['id'],
            'name'            => $u['name'],
            'mobile_number'   => $u['mobile_number'],
            'email'           => $u['email'],
            'pincode'         => $u['pincode'] ?? null,
            'wallet_balance'  => (float) ($u['wallet_balance'] ?? 0),
            'status'          => $u['status'],
            'created_at'      => $u['created_at'],
            'referrer_id'     => $refId,
            'referrer_name'   => $ref['name'] ?? null,
            'referrer_mobile' => $ref['mobile_number'] ?? null,
        ];
    }

    private function requireAdmin(): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'admin') return $this->fail('Forbidden', 403);
        return null;
    }
}
