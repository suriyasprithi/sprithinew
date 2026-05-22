<?php

namespace App\Services;

use Firebase\JWT\JWT;
use CodeIgniter\HTTP\CURLRequest;

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

    public function sendToToken(string $deviceToken, string $title, ?string $body, ?array $data = null): bool
    {
        if (! $this->isConfigured()) {
            log_message('info', 'FCM not configured — skipping send');
            return false;
        }

        $accessToken = $this->getAccessToken();
        if (! $accessToken) return false;

        $creds     = $this->loadCredentials();
        $projectId = $creds['project_id'] ?? null;
        if (! $projectId) {
            log_message('error', 'FCM: project_id missing from service-account JSON');
            return false;
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
        try {
            /** @var CURLRequest $client */
            $client   = service('curlrequest', ['timeout' => 10]);
            $response = $client->post($url, [
                'headers' => [
                    'Authorization' => "Bearer {$accessToken}",
                    'Content-Type'  => 'application/json',
                ],
                'json'        => $payload,
                'http_errors' => false,
            ]);
            $code = $response->getStatusCode();
            if ($code >= 200 && $code < 300) return true;
            log_message('error', 'FCM send failed: ' . $code . ' ' . $response->getBody());
            return false;
        } catch (\Throwable $e) {
            log_message('error', 'FCM exception: ' . $e->getMessage());
            return false;
        }
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

        try {
            /** @var CURLRequest $client */
            $client   = service('curlrequest', ['timeout' => 10]);
            $response = $client->post('https://oauth2.googleapis.com/token', [
                'form_params' => [
                    'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    'assertion'  => $jwt,
                ],
                'http_errors' => false,
            ]);
            $body = json_decode((string) $response->getBody(), true) ?: [];
            $token = $body['access_token'] ?? null;
            if (! $token) {
                log_message('error', 'OAuth token fetch failed: ' . $response->getBody());
                return null;
            }
            $cache->save($cacheKey, $token, max(60, (int) ($body['expires_in'] ?? 3600) - 60));
            return $token;
        } catch (\Throwable $e) {
            log_message('error', 'OAuth fetch exception: ' . $e->getMessage());
            return null;
        }
    }
}
