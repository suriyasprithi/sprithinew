<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Per-IP (and optionally per-field) fixed-window rate limit using cache.
 *
 * Args: bucket, ipMax, ipWindow [, fieldName, fieldMax, fieldWindow]
 *   rate_limit:login,30,300                       → 30 req / 300s per IP
 *   rate_limit:otp,30,3600,mobile_number,5,3600   → 30/h per IP AND 5/h per mobile
 *
 * The optional per-field limit keys on a request body field (e.g. mobile_number)
 * so on shared carrier IPs (CGNAT, common on mobile) many real users aren't
 * throttled together — each phone number gets its own quota, while the looser
 * per-IP cap still stops one IP enumerating many numbers / brute-forcing.
 */
class RateLimitFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $args = $arguments ?? [];
        if (count($args) < 3) return; // misconfigured → skip rather than block

        $cache  = service('cache');
        $bucket = (string) $args[0];

        // Per-IP limit (always applied).
        $ip = $request->getIPAddress() ?: 'unknown';
        if ($resp = $this->hit($cache, $bucket . '_ip_' . hash('crc32b', $ip), (int) $args[1], (int) $args[2])) {
            return $resp;
        }

        // Optional per-field limit (e.g. per mobile_number) — args[3..5].
        if (count($args) >= 6) {
            $field = (string) $args[3];
            $val   = $this->fieldValue($request, $field);
            if ($val !== ''
                && ($resp = $this->hit($cache, $bucket . '_' . $field . '_' . hash('crc32b', $val), (int) $args[4], (int) $args[5]))) {
                return $resp;
            }
        }
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
    }

    /** Count one hit on a bucket; return a 429 response if the cap is exceeded, else null. */
    private function hit($cache, string $key, int $max, int $win): ?ResponseInterface
    {
        $win = max(1, $win);
        if ($max <= 0) return null;
        $k       = 'rl_' . $key; // cache keys can't contain :{}()@/\
        $current = (int) ($cache->get($k) ?? 0);
        if ($current >= $max) {
            return service('response')
                ->setStatusCode(429)
                ->setHeader('Retry-After', (string) $win)
                ->setJSON(['success' => false, 'message' => 'Too many requests', 'errors' => null]);
        }
        $cache->save($k, $current + 1, $win);
        return null;
    }

    /** Read a field from the JSON body or POST (used to key by mobile_number). */
    private function fieldValue(RequestInterface $request, string $field): string
    {
        $body = $request->getJSON(true);
        if (is_array($body) && isset($body[$field])) return trim((string) $body[$field]);
        $post = $request->getPost($field);
        return $post !== null ? trim((string) $post) : '';
    }
}
