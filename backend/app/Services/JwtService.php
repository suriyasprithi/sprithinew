<?php

namespace App\Services;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\SignatureInvalidException;
use Throwable;

class JwtService
{
    private string $secret;
    private int $accessTtl;
    private int $refreshTtl;
    private string $algo = 'HS256';

    public function __construct()
    {
        $this->secret     = (string) env('jwt.secret', '');
        $this->accessTtl  = (int) env('jwt.accessTtl', 900);
        // Default 1 year — the session is a sliding window (each refresh re-issues
        // a fresh refresh token), so an active user effectively stays logged in
        // until they log out manually. Override via env('jwt.refreshTtl').
        $this->refreshTtl = (int) env('jwt.refreshTtl', 31536000);

        if ($this->secret === '') {
            throw new \RuntimeException('JWT secret is not configured.');
        }
    }

    public function issueAccessToken(int $userId, string $role): string
    {
        return $this->encode([
            'sub'  => $userId,
            'role' => $role,
            'typ'  => 'access',
        ], $this->accessTtl);
    }

    public function issueRefreshToken(int $userId, string $role): string
    {
        return $this->encode([
            'sub'  => $userId,
            'role' => $role,
            'typ'  => 'refresh',
        ], $this->refreshTtl);
    }

    private function encode(array $claims, int $ttl): string
    {
        $now = time();
        $payload = array_merge([
            'iat' => $now,
            'nbf' => $now,
            'exp' => $now + $ttl,
        ], $claims);
        return JWT::encode($payload, $this->secret, $this->algo);
    }

    /**
     * @return array{ok:bool, payload?:object, error?:string}
     */
    public function decode(string $token): array
    {
        try {
            $payload = JWT::decode($token, new Key($this->secret, $this->algo));
            return ['ok' => true, 'payload' => $payload];
        } catch (ExpiredException $e) {
            return ['ok' => false, 'error' => 'expired'];
        } catch (SignatureInvalidException $e) {
            return ['ok' => false, 'error' => 'invalid_signature'];
        } catch (Throwable $e) {
            return ['ok' => false, 'error' => 'invalid'];
        }
    }

    public function accessTtl(): int
    {
        return $this->accessTtl;
    }

    public function refreshTtl(): int
    {
        return $this->refreshTtl;
    }
}
