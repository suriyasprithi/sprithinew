<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Simple per-IP fixed-window rate limit using cache.
 * Usage:  ['rate_limit' => 'auth-login,5,300']  → 5 requests per 300s window
 *         ['rate_limit' => 'api,60,60']         → 60 req per 60s
 */
class RateLimitFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $args = $arguments ?? [];
        if (count($args) < 3) return; // misconfigured → skip rather than block

        [$bucket, $maxStr, $winStr] = $args;
        $max = (int) $maxStr;
        $win = max(1, (int) $winStr);
        if ($max <= 0) return;

        $ip   = $request->getIPAddress() ?: 'unknown';
        $key  = 'rl_' . $bucket . '_' . hash('crc32b', $ip); // cache keys can't contain :{}()@/\
        $cache = service('cache');

        $current = (int) ($cache->get($key) ?? 0);
        if ($current >= $max) {
            return service('response')
                ->setStatusCode(429)
                ->setHeader('Retry-After', (string) $win)
                ->setJSON(['success' => false, 'message' => 'Too many requests', 'errors' => null]);
        }
        $cache->save($key, $current + 1, $win);
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
    }
}
