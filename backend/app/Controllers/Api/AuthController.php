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

        // Update referrer chain (counts + referrals table rows) and award the
        // L1 welcome bonus. The activity feed reads from the referrals table,
        // so without those rows the new signup wouldn't appear there.
        if ($referrerId) {
            $welcomeAmount = (float) (new \App\Models\SystemSettingsModel())
                ->get('welcome.bonus_amount', '15');
            $this->bumpUplineLevelCounts($referrerId, (int) $userId, $welcomeAmount);
            (new WelcomeBonusService())->award($referrerId, (int) $userId);
        }

        return $this->issueTokens((int) $userId, $role, $users->find($userId), 201, 'Registered');
    }

    /**
     * Walk up to 3 levels and: (a) bump level_*_count on each ancestor,
     * (b) insert a referrals row for each ancestor so the activity feed
     * shows the signup. L1 carries the welcome bonus amount; L2/L3 carry 0.
     */
    private function bumpUplineLevelCounts(int $referrerId, int $newCustomerId = 0, float $welcomeAmount = 15.0): void
    {
        $users    = new UserModel();
        $current  = $users->find($referrerId);
        $refModel = new \App\Models\ReferralModel();
        for ($level = 1; $level <= 3; $level++) {
            if (! $current) break;
            $col = "level_{$level}_count";
            $users->update($current['id'], [$col => (int) ($current[$col] ?? 0) + 1]);
            if ($newCustomerId > 0) {
                try {
                    $refModel->insert([
                        'referrer_id'  => (int) $current['id'],
                        'referred_id'  => $newCustomerId,
                        'level'        => $level,
                        'bonus_amount' => $level === 1 ? $welcomeAmount : 0,
                    ]);
                } catch (\Throwable $e) {
                    log_message('error', 'Referral insert failed: ' . $e->getMessage());
                }
            }
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

        if (! $user || ! $this->verifyPassword($data['password'], $user, $users)) {
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
        if (! $this->verifyPassword($data['password'], $user, $users)) {
            return $this->fail('Invalid credentials', 401);
        }

        return $this->issueTokens((int) $user['id'], $user['role'], $user, 200, 'Logged in');
    }

    /**
     * Verify a password against the new bcrypt hash, falling back to the legacy
     * value imported from the old site (MD5 or plaintext). On a successful
     * legacy match the password is rehashed to bcrypt and the legacy value is
     * cleared, so each migrated user upgrades transparently on first login.
     */
    private function verifyPassword(string $plain, array $user, UserModel $users): bool
    {
        if (! empty($user['password_hash']) && password_verify($plain, $user['password_hash'])) {
            return true;
        }

        $legacy = $user['legacy_password'] ?? null;
        if ($legacy !== null && $legacy !== '' && (md5($plain) === $legacy || $plain === $legacy)) {
            $users->update($user['id'], [
                'password_hash'   => password_hash($plain, PASSWORD_BCRYPT),
                'legacy_password' => null,
            ]);
            return true;
        }

        return false;
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

    public function forgotPassword(): ResponseInterface
    {
        if (! $this->validate(['email' => 'required|valid_email|max_length[150]'])) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }
        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $email = trim((string) $d['email']);

        $users = new UserModel();
        $user  = $users->where('email', $email)->where('status', 'active')->first();

        // Generic response either way — don't reveal whether the email exists.
        $genericMessage = 'If an account with that email exists, a reset link has been sent.';
        if (! $user) {
            return $this->ok(null, $genericMessage);
        }

        $token = bin2hex(random_bytes(32));
        $users->update($user['id'], [
            'password_reset_token'      => $token,
            'password_reset_expires_at' => date('Y-m-d H:i:s', time() + 3600),
        ]);

        // Build reset URL from the incoming request's host (not the static
        // app.baseURL config, which may point at the wrong port locally).
        $uri = $this->request->getUri();
        $scheme = $uri->getScheme() ?: 'http';
        $host = $uri->getHost();
        $port = $uri->getPort();
        $baseUrl = $scheme . '://' . $host;
        if ($port && ! in_array($port, [80, 443], true)) {
            $baseUrl .= ':' . $port;
        }
        // Staff land at /admin/reset-password, customers at /customer/reset-password.
        $prefix  = $user['role'] === 'customer' ? '/customer' : '/admin';
        $resetUrl = $baseUrl . $prefix . '/reset-password?token=' . $token;

        // Log the URL so dev can grab it without SMTP set up.
        log_message('info', 'Password reset URL for ' . $email . ': ' . $resetUrl);

        // Try to send the email (silent fail if SMTP not configured).
        try {
            $mailer = service('email');
            $mailer->setTo($email);
            $mailer->setSubject('Reset your password');
            $mailer->setMessage(
                "Hello " . ($user['name'] ?? '') . ",\n\n"
                . "Click the link below to reset your password. The link expires in 1 hour.\n\n"
                . $resetUrl . "\n\n"
                . "If you didn't request this, you can ignore this email."
            );
            $mailer->send();
        } catch (\Throwable $e) {
            log_message('warning', 'Could not send reset email to ' . $email . ': ' . $e->getMessage());
        }

        return $this->ok(null, $genericMessage);
    }

    public function resetPassword(): ResponseInterface
    {
        if (! $this->validate([
            'token'    => 'required|string|min_length[32]|max_length[64]',
            'password' => 'required|string|min_length[6]|max_length[64]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $users = new UserModel();
        $user  = $users->where('password_reset_token', (string) $d['token'])->first();

        if (! $user) return $this->fail('Invalid or expired reset link', 400);
        $expiry = $user['password_reset_expires_at'] ?? null;
        if (! $expiry || strtotime($expiry) < time()) {
            return $this->fail('Reset link expired', 400);
        }

        $users->update($user['id'], [
            'password_hash'             => password_hash($d['password'], PASSWORD_BCRYPT),
            'password_reset_token'      => null,
            'password_reset_expires_at' => null,
        ]);

        return $this->ok(null, 'Password updated. You can now sign in.');
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
            'monthly_wallet' => (float) ($user['monthly_wallet'] ?? 0),
            'lucky_wallet'   => (float) ($user['lucky_wallet'] ?? 0),
            'qr_wallet'      => (float) ($user['qr_wallet'] ?? 0),
            'token_balance'  => (int) ($user['token_balance'] ?? 0),
            'level_1_count'  => (int) ($user['level_1_count'] ?? 0),
            'level_2_count'  => (int) ($user['level_2_count'] ?? 0),
            'level_3_count'  => (int) ($user['level_3_count'] ?? 0),
        ];
    }
}
