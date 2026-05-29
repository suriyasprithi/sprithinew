<?php

namespace App\Services;

use Firebase\JWT\JWT;

/**
 * Sends FCM v1 messages using a Firebase service-account JSON.
 *
 * Setup:
 *   1. Firebase Console > Project settings > Service accounts > Generate new private key
 *   2. Place the .json file outside webroot, e.g. backend/writable/firebase-service-account.json
 *   3. Set in .env:
 *        firebase.credentials = writable/firebase-service-account.json
 *      (relative paths resolve from the backend root; absolute paths also accepted)
 *
 * The Firebase project ID is read from the JSON file's "project_id" field.
 * Until configured the service is a no-op (returns false).
 */
class FirebaseService
{
    private ?string $credentialsPath;
    private ?array  $credentials = null;

    public function __construct()
    {
        $raw = env('firebase.credentials') ?: null;
        if ($raw === null) {
            $this->credentialsPath = null;
            return;
        }
        $isAbsolute = preg_match('#^([a-zA-Z]:[\\\\/]|/)#', $raw) === 1;
        $this->credentialsPath = $isAbsolute
            ? $raw
            : rtrim(ROOTPATH, '/\\') . DIRECTORY_SEPARATOR . $raw;
    }

    public function isConfigured(): bool
    {
        return $this->credentialsPath !== null
            && is_file($this->credentialsPath)
            && $this->loadCredentials() !== null;
    }

    public const SENT         = 'sent';
    public const UNREGISTERED = 'unregistered'; // stale token — caller should delete it
    public const FAILED       = 'failed';

    /** Back-compat wrapper. Returns true only when delivery succeeded. */
    public function sendToToken(string $deviceToken, string $title, ?string $body, ?array $data = null): bool
    {
        return $this->sendToTokenWithStatus($deviceToken, $title, $body, $data) === self::SENT;
    }

    /** @return string one of self::SENT|UNREGISTERED|FAILED. */
    public function sendToTokenWithStatus(string $deviceToken, string $title, ?string $body, ?array $data = null): string
    {
        if (! $this->isConfigured()) {
            log_message('info', 'FCM not configured — skipping send');
            return self::FAILED;
        }

        $accessToken = $this->getAccessToken();
        if (! $accessToken) return self::FAILED;

        $creds     = $this->loadCredentials();
        $projectId = $creds['project_id'] ?? null;
        if (! $projectId) {
            log_message('error', 'FCM: project_id missing from service-account JSON');
            return self::FAILED;
        }

        $payload = [
            'message' => [
                'token'        => $deviceToken,
                'notification' => array_filter([
                    'title' => $title,
                    'body'  => $body,
                ]),
                'data'         => $data ? array_map('strval', $data) : new \stdClass(),
                'android'      => [
                    'priority'     => 'HIGH',
                    'notification' => ['sound' => 'default'],
                ],
                'apns'         => [
                    'payload' => ['aps' => ['sound' => 'default']],
                ],
            ],
        ];

        $url = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";
        $res = $this->rawPost($url, [
            "Authorization: Bearer {$accessToken}",
            'Content-Type: application/json',
        ], json_encode($payload));
        if ($res['code'] >= 200 && $res['code'] < 300) return self::SENT;
        log_message('error', 'FCM send failed: ' . $res['code'] . ' ' . $res['body'] . ($res['error'] ? ' curl_err=' . $res['error'] : ''));
        // 404 or "UNREGISTERED" in body → token is dead; caller should prune.
        if ($res['code'] === 404 || stripos((string) $res['body'], 'UNREGISTERED') !== false) {
            return self::UNREGISTERED;
        }
        return self::FAILED;
    }

    /**
     * Raw cURL POST so we can reliably attach CURLOPT_CAINFO on Windows
     * (CI4's CURLRequest doesn't honour `verify` => path consistently).
     *
     * @param string[] $headers
     */
    private function rawPost(string $url, array $headers, string $body): array
    {
        $cacert = $this->caBundlePath();
        // Default: verify ON. Only turn OFF when env is literally '0' or 'false'.
        $sslVerifyEnv = env('firebase.ssl_verify');
        $sslVerify = !in_array((string) $sslVerifyEnv, ['0', 'false', 'no'], true);

        $opts = [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => $sslVerify,
            CURLOPT_SSL_VERIFYHOST => $sslVerify ? 2 : 0,
        ];
        if ($sslVerify && $cacert !== null) $opts[CURLOPT_CAINFO] = $cacert;

        log_message('error', 'FCM rawPost: url=' . $url . ' verify=' . ($sslVerify ? '1' : '0') . ' cacert=' . ($cacert ?? '(null)'));

        $ch = curl_init($url);
        curl_setopt_array($ch, $opts);
        $body = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        // PHP 8+ auto-cleans cURL handles when out of scope — no curl_close needed.
        return ['code' => $code, 'body' => is_string($body) ? $body : '', 'error' => $err];
    }

    /**
     * Locate a CA bundle for HTTPS verification. Returns null if none found
     * (default cURL/system trust store is then used). On Windows without a
     * properly-configured cainfo, you want to point at writable/cacert.pem
     * — download from https://curl.se/ca/cacert.pem.
     */
    private function caBundlePath(): ?string
    {
        static $resolved = false;
        static $cached   = null;
        if ($resolved) return $cached;
        $resolved = true;

        $candidates = [
            env('firebase.cacert') ?: null,
            rtrim(ROOTPATH, '/\\') . DIRECTORY_SEPARATOR . 'writable' . DIRECTORY_SEPARATOR . 'cacert.pem',
        ];
        foreach ($candidates as $p) {
            if ($p && is_file($p)) {
                log_message('info', 'FCM cacert resolved: ' . $p);
                return $cached = $p;
            }
        }
        log_message('warning', 'FCM cacert: none of the candidates found — ' . json_encode($candidates));
        return null;
    }

    private function loadCredentials(): ?array
    {
        if ($this->credentials !== null) return $this->credentials;
        if ($this->credentialsPath === null || ! is_file($this->credentialsPath)) return null;

        $raw = file_get_contents($this->credentialsPath);
        $obj = json_decode($raw, true);
        if (! is_array($obj) || empty($obj['client_email']) || empty($obj['private_key']) || empty($obj['project_id'])) {
            return null;
        }
        return $this->credentials = $obj;
    }

    private function getAccessToken(): ?string
    {
        $cache    = service('cache');
        $cacheKey = 'firebase_access_token';
        $cached   = $cache->get($cacheKey);
        if ($cached) return $cached;

        $creds = $this->loadCredentials();
        if (! $creds) return null;

        $now    = time();
        $claims = [
            'iss'   => $creds['client_email'],
            'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
            'aud'   => 'https://oauth2.googleapis.com/token',
            'exp'   => $now + 3600,
            'iat'   => $now,
        ];

        try {
            $jwt = JWT::encode($claims, $creds['private_key'], 'RS256');
        } catch (\Throwable $e) {
            log_message('error', 'Firebase JWT encode failed: ' . $e->getMessage());
            return null;
        }

        $formBody = http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion'  => $jwt,
        ]);
        $res = $this->rawPost('https://oauth2.googleapis.com/token', [
            'Content-Type: application/x-www-form-urlencoded',
        ], $formBody);
        if ($res['code'] < 200 || $res['code'] >= 300) {
            log_message('error', 'OAuth token fetch failed: ' . $res['code'] . ' ' . $res['body'] . ($res['error'] ? ' curl_err=' . $res['error'] : ''));
            return null;
        }
        $body = json_decode($res['body'], true) ?: [];
        $token = $body['access_token'] ?? null;
        if (! $token) {
            log_message('error', 'OAuth token fetch: no access_token in response — ' . $res['body']);
            return null;
        }
        $cache->save($cacheKey, $token, max(60, (int) ($body['expires_in'] ?? 3600) - 60));
        return $token;
    }
}
