<?php

namespace App\Controllers\Api;

use App\Models\UserModel;
use App\Services\JwtService;
use App\Services\WelcomeBonusService;
use CodeIgniter\HTTP\ResponseInterface;

class AuthController extends BaseApiController
{
    private const ALLOWED_ROLES = ['customer', 'vendor', 'taluk', 'district', 'state', 'driver', 'admin'];

    public function register(): ResponseInterface
    {
        $rules = [
            'name'          => 'required|string|min_length[2]|max_length[100]',
            'mobile_number' => 'required|string|min_length[7]|max_length[15]',
            'password'      => 'required|string|min_length[6]|max_length[64]',
            'email'         => 'permit_empty|valid_email|max_length[150]',
            'pincode'       => 'permit_empty|string|max_length[10]',
            'referrer_code' => 'permit_empty|string|max_length[15]',
        ];
        if (! $this->validate($rules)) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }

        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        $role = 'customer';

        $users = new UserModel();
        if ($users->mobileExistsForRole($data['mobile_number'], $role)) {
            return $this->fail('Mobile number already registered', 409);
        }

        // Resolve referrer (by mobile_number = referral_code)
        $referrerId = null;
        if (! empty($data['referrer_code'])) {
            $ref = $users->where('mobile_number', $data['referrer_code'])
                ->where('role', 'customer')
                ->where('status', 'active')
                ->first();
            if ($ref) $referrerId = (int) $ref['id'];
        }

        $userId = $users->insert([
            'name'          => trim($data['name']),
            'mobile_number' => trim($data['mobile_number']),
            'email'         => isset($data['email']) ? trim($data['email']) : null,
            'password_hash' => password_hash($data['password'], PASSWORD_BCRYPT),
            'role'          => $role,
            'status'        => 'active',
            'pincode'       => $data['pincode'] ?? null,
            'referrer_id'   => $referrerId,
        ], true);

        if (! $userId) {
            return $this->fail('Could not create user', 500, $users->errors());
        }

        // Update referrer chain counts (L1, L2, L3) and award welcome bonus.
        // (ReferralModel insert deferred to Phase 3 when migration 14 lands.)
        if ($referrerId) {
            $this->bumpUplineLevelCounts($referrerId);
            (new WelcomeBonusService())->award($referrerId, (int) $userId);
        }

        return $this->issueTokens((int) $userId, $role, $users->find($userId), 201, 'Registered');
    }

    /** Walk up to 3 levels and increment level_*_count on each ancestor. */
    private function bumpUplineLevelCounts(int $referrerId): void
    {
        $users   = new UserModel();
        $current = $users->find($referrerId);
        for ($level = 1; $level <= 3; $level++) {
            if (! $current) break;
            $col = "level_{$level}_count";
            $users->update($current['id'], [$col => (int) ($current[$col] ?? 0) + 1]);
            if (empty($current['referrer_id'])) break;
            $current = $users->find((int) $current['referrer_id']);
        }
    }

    public function login(): ResponseInterface
    {
        $rules = [
            'mobile_number' => 'required|string',
            'password'      => 'required|string',
            'role'          => 'required|in_list[' . implode(',', self::ALLOWED_ROLES) . ']',
        ];
        if (! $this->validate($rules)) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }

        $data  = $this->request->getJSON(true) ?? $this->request->getPost();
        $users = new UserModel();
        $user  = $users->findByMobileAndRole($data['mobile_number'], $data['role']);

        if (! $user || ! password_verify($data['password'], $user['password_hash'])) {
            return $this->fail('Invalid credentials', 401);
        }
        if ($user['status'] !== 'active') {
            return $this->fail('Account ' . $user['status'], 403);
        }

        return $this->issueTokens((int) $user['id'], $user['role'], $user, 200, 'Logged in');
    }

    public function staffLogin(): ResponseInterface
    {
        $rules = [
            'mobile_number' => 'required|string',
            'password'      => 'required|string',
        ];
        if (! $this->validate($rules)) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }

        $data    = $this->request->getJSON(true) ?? $this->request->getPost();
        $users   = new UserModel();
        $matches = $users->findActiveStaffByMobile($data['mobile_number']);

        if (count($matches) === 0) {
            return $this->fail('Invalid credentials', 401);
        }
        if (count($matches) > 1) {
            return $this->fail('Multiple staff accounts found — please use the role-specific login URL', 409);
        }

        $user = $matches[0];
        if (! password_verify($data['password'], $user['password_hash'])) {
            return $this->fail('Invalid credentials', 401);
        }

        return $this->issueTokens((int) $user['id'], $user['role'], $user, 200, 'Logged in');
    }

    public function refresh(): ResponseInterface
    {
        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        $token = $data['refresh_token'] ?? '';
        if (! $token) {
            return $this->fail('refresh_token required', 422);
        }

        $jwt = new JwtService();
        $result = $jwt->decode($token);
        if (! $result['ok']) {
            return $this->fail('Invalid refresh token', 401, ['error' => $result['error']]);
        }
        if (($result['payload']->typ ?? '') !== 'refresh') {
            return $this->fail('Invalid token type', 401);
        }

        $userId = (int) $result['payload']->sub;
        $role   = (string) $result['payload']->role;
        $user   = (new UserModel())->find($userId);
        if (! $user || $user['status'] !== 'active') {
            return $this->fail('Account not available', 403);
        }

        return $this->issueTokens($userId, $role, $user, 200, 'Refreshed');
    }

    public function me(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) {
            return $this->fail('Unauthorized', 401);
        }
        $user = (new UserModel())->find($auth->id);
        if (! $user) {
            return $this->fail('User not found', 404);
        }
        return $this->ok($this->publicUser($user));
    }

    public function logout(): ResponseInterface
    {
        // Stateless JWT — client discards tokens. Hook for token blacklist later.
        return $this->ok(null, 'Logged out');
    }

    public function updateAddress(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! $this->validate([
            'address_line' => 'permit_empty|string|max_length[255]',
            'landmark'     => 'permit_empty|string|max_length[100]',
            'city'         => 'permit_empty|string|max_length[80]',
            'pincode'      => 'permit_empty|string|max_length[10]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $payload = [];
        foreach (['address_line', 'landmark', 'city', 'pincode'] as $k) {
            if (array_key_exists($k, $d)) $payload[$k] = $d[$k] === '' ? null : $d[$k];
        }
        if ($payload) (new UserModel())->update((int) $auth->id, $payload);
        $user = (new UserModel())->find((int) $auth->id);
        return $this->ok($this->publicUser($user), 'Updated');
    }

    private function issueTokens(int $userId, string $role, array $user, int $status, string $message): ResponseInterface
    {
        $jwt = new JwtService();
        return $this->ok([
            'access_token'      => $jwt->issueAccessToken($userId, $role),
            'refresh_token'     => $jwt->issueRefreshToken($userId, $role),
            'access_expires_in' => $jwt->accessTtl(),
            'token_type'        => 'Bearer',
            'user'              => $this->publicUser($user),
        ], $message, $status);
    }

    private function publicUser(array $user): array
    {
        return [
            'id'             => (int) $user['id'],
            'name'           => $user['name'],
            'email'          => $user['email'],
            'mobile_number'  => $user['mobile_number'],
            'role'           => $user['role'],
            'status'         => $user['status'],
            'pincode'        => $user['pincode'] ?? null,
            'address_line'   => $user['address_line'] ?? null,
            'landmark'       => $user['landmark'] ?? null,
            'city'           => $user['city'] ?? null,
            'wallet_balance' => (float) ($user['wallet_balance'] ?? 0),
            'level_wallet'   => (float) ($user['level_wallet'] ?? 0),
            'level_1_wallet' => (float) ($user['level_1_wallet'] ?? 0),
            'level_2_wallet' => (float) ($user['level_2_wallet'] ?? 0),
            'level_3_wallet' => (float) ($user['level_3_wallet'] ?? 0),
            'buyback_wallet' => (float) ($user['buyback_wallet'] ?? 0),
            'global_wallet'  => (float) ($user['global_wallet'] ?? 0),
            'token_balance'  => (int) ($user['token_balance'] ?? 0),
            'level_1_count'  => (int) ($user['level_1_count'] ?? 0),
            'level_2_count'  => (int) ($user['level_2_count'] ?? 0),
            'level_3_count'  => (int) ($user['level_3_count'] ?? 0),
        ];
    }
}
