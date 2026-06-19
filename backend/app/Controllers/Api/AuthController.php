<?php

namespace App\Controllers\Api;

use App\Models\UserModel;
use App\Services\JwtService;
use App\Services\SmsAlertService;
use App\Services\WelcomeBonusService;
use CodeIgniter\HTTP\ResponseInterface;

class AuthController extends BaseApiController
{
    private const ALLOWED_ROLES = ['customer', 'vendor', 'taluk', 'district', 'state', 'driver', 'admin'];

    // Registration OTP: 6 digits, valid 10 min, 60s resend cooldown, 5 tries.
    private const OTP_TTL      = 600;
    private const OTP_COOLDOWN = 60;
    private const OTP_TRIES    = 5;

    /**
     * Send a one-time password by SMS to verify a mobile before signup.
     * Customer-scope: rejects a number that's already a customer. The OTP is
     * generated and held server-side in cache (keyed by mobile); register()
     * checks it. No-op-safe if SMS Alert isn't configured (returns 502).
     */
    public function sendOtp(): ResponseInterface
    {
        $body   = $this->request->getJSON(true) ?? $this->request->getPost();
        $mobile = trim((string) ($body['mobile_number'] ?? ''));
        if (! preg_match('/^[0-9]{10}$/', $mobile)) {
            return $this->fail('Enter a valid 10-digit mobile number', 422);
        }
        if ((new UserModel())->mobileExistsForRole($mobile, 'customer')) {
            return $this->fail('Mobile number already registered', 409);
        }

        $cache = service('cache');
        // Cache keys can't contain reserved chars (:{}()/\@) — use underscores.
        if ($cache->get("otp_cd_{$mobile}")) {
            return $this->fail('Please wait a moment before requesting another OTP', 429);
        }

        $otp  = (string) random_int(100000, 999999);
        // NOTE: the fixed part must match the DLT template EXACTLY or SMS Alert
        // rejects with "Invalid Template Match". The approved template is
        // "Your login OTP for Loyal Wings ERP is {#var#}". We fold the brand into
        // the trailing {#var#} value (OTP + brand) so no new DLT template is
        // needed — variable is last, so it captures the whole tail.
        $text = "Your login OTP for Loyal Wings ERP is {$otp} - Sprithi Digital Mart";
        if (! (new SmsAlertService())->send($mobile, $text)) {
            return $this->fail('Could not send OTP. Please try again.', 502);
        }

        $cache->save("otp_{$mobile}", ['otp' => $otp, 'tries' => 0], self::OTP_TTL);
        $cache->save("otp_cd_{$mobile}", 1, self::OTP_COOLDOWN);
        return $this->ok(['sent' => true], 'OTP sent');
    }

    /**
     * Check the user-entered OTP against the cached one. On success the entry is
     * cleared so it can't be replayed. Wrong tries are counted; after
     * self::OTP_TRIES the entry is dropped and the customer must resend.
     */
    private function consumeOtp(string $mobile, string $otp): bool
    {
        $cache = service('cache');
        $key   = "otp_{$mobile}";
        $rec   = $cache->get($key);
        if (! is_array($rec) || empty($rec['otp'])) {
            return false;
        }
        if ((int) ($rec['tries'] ?? 0) >= self::OTP_TRIES) {
            $cache->delete($key);
            return false;
        }
        if (! hash_equals((string) $rec['otp'], $otp)) {
            $rec['tries'] = (int) ($rec['tries'] ?? 0) + 1;
            $cache->save($key, $rec, self::OTP_TTL);
            return false;
        }
        $cache->delete($key);
        return true;
    }

    public function register(): ResponseInterface
    {
        $rules = [
            'name'          => 'required|string|min_length[2]|max_length[100]',
            'mobile_number' => 'required|regex_match[/^[0-9]{10}$/]',
            'password'      => 'required|string|min_length[6]|max_length[64]',
            'email'         => 'permit_empty|valid_email|max_length[150]',
            'pincode'       => 'permit_empty|string|max_length[10]',
            'referrer_code' => 'permit_empty|regex_match[/^[0-9]{10}$/]',
            'dob'           => 'required|valid_date',
            'state_id'      => 'required|is_natural_no_zero',
            'district_id'   => 'required|is_natural_no_zero',
            'taluk_id'      => 'permit_empty|is_natural_no_zero',
            'otp'           => 'required|regex_match[/^[0-9]{6}$/]',
        ];
        if (! $this->validate($rules)) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }

        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        $role = 'customer';

        // Block under-18 sign-ups (CI4 has no built-in min-age rule).
        $age = (int) (new \DateTime($data['dob']))->diff(new \DateTime('today'))->y;
        if ($age < 18) {
            return $this->fail('You must be at least 18 to register', 422);
        }

        $users = new UserModel();
        if ($users->mobileExistsForRole($data['mobile_number'], $role)) {
            return $this->fail('Mobile number already registered', 409);
        }

        // Verify the SMS OTP issued by sendOtp() before creating the account.
        if (! $this->consumeOtp($data['mobile_number'], (string) $data['otp'])) {
            return $this->fail('Invalid or expired OTP. Please resend.', 422);
        }

        // Resolve referrer (by mobile_number = referral_code). Security:
        //  - self-referral (code == own mobile) is ignored,
        //  - an invalid/expired code that doesn't resolve to an active customer
        //    simply yields no referrer (no error, no reward),
        //  - duplicate rewards are impossible because a mobile can register only
        //    once per role (the mobileExistsForRole() check above), so one
        //    account is created — and rewarded — at most once.
        $referrerId   = null;
        $referrerCode = ! empty($data['referrer_code']) ? preg_replace('/\D/', '', (string) $data['referrer_code']) : '';
        if ($referrerCode !== '' && $referrerCode !== trim((string) $data['mobile_number'])) {
            $ref = $users->where('mobile_number', $referrerCode)
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
            'dob'           => $data['dob'],
            'state_id'      => (int) $data['state_id'],
            'district_id'   => (int) $data['district_id'],
            'taluk_id'      => ! empty($data['taluk_id']) ? (int) $data['taluk_id'] : null,
        ], true);

        if (! $userId) {
            return $this->fail('Could not create user', 500, $users->errors());
        }

        // Update referrer chain (counts + referrals table rows) and award the
        // L1 welcome bonus. The activity feed reads from the referrals table,
        // so without those rows the new signup wouldn't appear there.
        if ($referrerId) {
            $this->bumpUplineLevelCounts($referrerId, (int) $userId);
            (new WelcomeBonusService())->award($referrerId, (int) $userId);
            log_message('info', 'referral attached: new_user={u} referrer={r} code={c}', [
                'u' => (int) $userId, 'r' => $referrerId, 'c' => $referrerCode,
            ]);
        }

        return $this->issueTokens((int) $userId, $role, $users->find($userId), 201, 'Registered');
    }

    /**
     * Public: is this mobile free for a NEW customer signup? Lets the register
     * form flag a duplicate on the field before submitting (register() still
     * rejects duplicates with 409 as the backstop). Customer-role scope only —
     * the same mobile can separately be a vendor/staff login.
     */
    public function checkMobile(): ResponseInterface
    {
        $mobile = trim((string) $this->request->getGet('mobile'));
        if (! preg_match('/^[0-9]{10}$/', $mobile)) {
            return $this->fail('Invalid mobile', 422);
        }
        $exists = (new UserModel())->mobileExistsForRole($mobile, 'customer');
        return $this->ok(['available' => ! $exists]);
    }

    /**
     * Walk up to 3 levels and: (a) bump level_*_count on each ancestor,
     * (b) insert a referrals row for each ancestor so the activity feed shows
     * the signup. Each row records the per-level welcome-bonus amount that
     * WelcomeBonusService::award() actually credits (L1/L2/L3), so the activity
     * feed and ReferralController's total_bonus reflect real earnings — not just
     * L1. Kept in sync with that service + legacy:backfill-referrals.
     */
    private function bumpUplineLevelCounts(int $referrerId, int $newCustomerId = 0): void
    {
        $users    = new UserModel();
        $current  = $users->find($referrerId);
        $refModel = new \App\Models\ReferralModel();

        $settings = new \App\Models\SystemSettingsModel();
        $active   = $settings->get('welcome.bonus_active', '1') === '1';
        $amount   = [
            1 => $active ? (float) $settings->get('welcome.bonus_amount', '15') : 0.0,
            2 => $active ? (float) $settings->get('welcome.bonus_l2', '10') : 0.0,
            3 => $active ? (float) $settings->get('welcome.bonus_l3', '5') : 0.0,
        ];

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
                        'bonus_amount' => $amount[$level] ?? 0,
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
            'mobile_number' => 'required|regex_match[/^[0-9]{10}$/]',
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
            'mobile_number' => 'required|regex_match[/^[0-9]{10}$/]',
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

    /**
     * Driver picks their own shift. The value must be the name of an ACTIVE
     * admin-defined shift (or empty to clear). Saved to users.shift, which the
     * admin Drivers page already reads — so the admin sees the driver's choice.
     */
    public function updateShift(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'driver') return $this->fail('Only drivers have a shift', 403);

        $d     = $this->request->getJSON(true) ?? $this->request->getPost() ?? [];
        $shift = trim((string) ($d['shift'] ?? ''));
        if ($shift !== '') {
            $ok = (new \App\Models\DriverShiftModel())->where('name', $shift)->where('is_active', 1)->first();
            if (! $ok) return $this->fail('Invalid shift', 422);
        }

        (new UserModel())->update((int) $auth->id, ['shift' => $shift !== '' ? $shift : null]);
        return $this->ok(['shift' => $shift !== '' ? $shift : null], 'Shift updated');
    }

    public function updateBank(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! $this->validate([
            'account_holder' => 'permit_empty|string|max_length[150]',
            'bank_name'      => 'permit_empty|string|max_length[100]',
            'account_number' => 'permit_empty|string|max_length[50]',
            'ifsc_code'      => 'permit_empty|string|max_length[100]',
            'upi'            => 'permit_empty|string|max_length[100]',
            'gst'            => 'permit_empty|string|max_length[30]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $payload = [];
        foreach (['account_holder', 'bank_name', 'account_number', 'ifsc_code', 'upi'] as $k) {
            if (array_key_exists($k, $d)) $payload[$k] = $d[$k] === '' ? null : trim((string) $d[$k]);
        }
        if ($payload) (new UserModel())->update((int) $auth->id, $payload);

        // GST is stored on the vendor profile, not the users row (PK = user_id).
        if (array_key_exists('gst', $d) && $auth->role === 'vendor') {
            $vp = new \App\Models\VendorProfileModel();
            if ($vp->where('user_id', (int) $auth->id)->first()) {
                $vp->update((int) $auth->id, ['gst' => $d['gst'] === '' ? null : trim((string) $d['gst'])]);
            }
        }

        $user = (new UserModel())->find((int) $auth->id);
        return $this->ok($this->publicUser($user), 'Bank details updated');
    }

    /** Vendor uploads their shop cover image (multipart `image`) → vendor_profiles.image. */
    public function updateShopImage(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'vendor') return $this->fail('Only vendors have a shop image', 403);

        $file = $this->request->getFile('image');
        if (! $file || ! $file->isValid() || $file->hasMoved()) return $this->fail('No image uploaded', 422);
        if ($file->getSize() > 5 * 1024 * 1024) return $this->fail('Image must be 5 MB or smaller', 422);
        if (! in_array($file->getMimeType(), ['image/jpeg', 'image/png', 'image/webp'], true)) {
            return $this->fail('Image must be a JPG, PNG or WEBP', 422);
        }

        $dir = FCPATH . 'uploads/shops/';
        if (! is_dir($dir)) @mkdir($dir, 0775, true);
        $name = $file->getRandomName();
        $file->move($dir, $name);
        $path = 'uploads/shops/' . $name;

        // Goes to pending review — the live `image` keeps showing to customers
        // until an admin approves. Re-uploading after a rejection resets to pending.
        $vp = new \App\Models\VendorProfileModel();
        if ($vp->where('user_id', (int) $auth->id)->first()) {
            $vp->update((int) $auth->id, [
                'image_pending'       => $path,
                'image_status'        => 'pending',
                'image_reject_reason' => null,
            ]);
        }

        $user = (new UserModel())->find((int) $auth->id);
        return $this->ok($this->publicUser($user), 'Shop image submitted for approval');
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
        // "Level commission" = the L1/L2/L3 wallet total MINUS the referral
        // signup bonuses that also land in those wallets (tagged welcome_bonus),
        // so the dashboard's LEVEL card can show purchase-commission only while
        // the per-level cards still include the bonus.
        $levelTotal = (float) ($user['level_1_wallet'] ?? 0)
                    + (float) ($user['level_2_wallet'] ?? 0)
                    + (float) ($user['level_3_wallet'] ?? 0);
        $refBonus = (float) (\Config\Database::connect()->query(
            "SELECT COALESCE(SUM(amount),0) AS s FROM wallet_transactions
             WHERE user_id = ? AND type = 'welcome_bonus'
               AND (notes LIKE '%[+level_1]%' OR notes LIKE '%[+level_2]%' OR notes LIKE '%[+level_3]%')",
            [(int) $user['id']]
        )->getRow()->s ?? 0);

        // GST + shop image live on the vendor's profile (not the users row) —
        // surface them so the vendor can see/edit them on their profile pages.
        $gst       = null;
        $shopImage = null;
        $shopImagePending = null;
        $shopImageStatus  = null;
        $shopImageReject  = null;
        if (($user['role'] ?? '') === 'vendor') {
            $prof             = (new \App\Models\VendorProfileModel())->where('user_id', (int) $user['id'])->first();
            $gst              = $prof['gst'] ?? null;
            $shopImage        = $prof['image'] ?? null;
            $shopImagePending = $prof['image_pending'] ?? null;
            $shopImageStatus  = $prof['image_status'] ?? null;
            $shopImageReject  = $prof['image_reject_reason'] ?? null;
        }

        return [
            'id'             => (int) $user['id'],
            'level_commission' => round($levelTotal - $refBonus, 2),
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
            'token_balance'  => (float) ($user['token_balance'] ?? 0),
            'bonus_balance'  => (float) ($user['bonus_balance'] ?? 0),
            'level_1_count'  => (int) ($user['level_1_count'] ?? 0),
            'level_2_count'  => (int) ($user['level_2_count'] ?? 0),
            'level_3_count'  => (int) ($user['level_3_count'] ?? 0),
            'kyc_status'     => $user['kyc_status'] ?? 'none',
            'kyc_note'       => $user['kyc_note'] ?? null,
            'account_holder' => $user['account_holder'] ?? null,
            'bank_name'      => $user['bank_name'] ?? null,
            'account_number' => $user['account_number'] ?? null,
            'ifsc_code'      => $user['ifsc_code'] ?? null,
            'upi'            => $user['upi'] ?? null,
            'gst'            => $gst,
            'shop_image'         => $shopImage,
            'shop_image_pending' => $shopImagePending,
            'shop_image_status'  => $shopImageStatus,
            'shop_image_reject_reason' => $shopImageReject,
        ];
    }
}
