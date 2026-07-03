<?php

namespace App\Services;

/**
 * Address → lat/lng via OpenStreetMap Nominatim (free, no API key).
 *
 * Usage policy we honour:
 *   - a real, identifying User-Agent is required, and
 *   - at most ~1 request/second (bulk callers, i.e. the vendors:geocode command,
 *     must sleep between calls — this class does NOT sleep for you).
 *
 * Every failure (network, timeout, no result, bad JSON) returns null and logs;
 * callers keep whatever coordinates they already had. No exceptions escape.
 */
class GeocodingService
{
    private string $endpoint = 'https://nominatim.openstreetmap.org/search';

    /**
     * Stable fingerprint of the address parts, used to detect real changes so we
     * don't re-geocode an address that only differs by case/whitespace.
     */
    public static function hash(?string $address, ?string $area, ?string $pincode): string
    {
        $parts = strtolower(trim((string) $address) . '|' . trim((string) $area) . '|' . trim((string) $pincode));
        return md5($parts);
    }

    /**
     * Resolve an address to coordinates.
     *
     * @return array{lat: float, lng: float}|null  null on any failure / no match
     */
    public function geocode(?string $address, ?string $area = '', ?string $pincode = ''): ?array
    {
        $address = trim((string) $address);
        $area    = trim((string) $area);
        $pincode = trim((string) $pincode);

        // Coarsening fallback. Real shop addresses often carry door/office numbers
        // ("Office 1 & 2, ...") that make the full string un-geocodable, so we retry
        // with progressively coarser queries down to just the pincode / city — still
        // a good-enough point for a "X km away" distance.
        $candidates = [];
        $add = static function (array $parts) use (&$candidates) {
            $q = trim(implode(', ', array_filter(array_map('trim', $parts), static fn ($v) => $v !== '')));
            if ($q !== '' && ! in_array($q, $candidates, true)) $candidates[] = $q;
        };
        $add([$address, $area, $pincode]);
        $add([$area, $pincode]);
        $add([$pincode]);
        $add([$area]);
        if (! $candidates) return null;

        $first = true;
        foreach ($candidates as $q) {
            // Stay within Nominatim's ~1 req/sec even across our own fallback tries.
            if (! $first) sleep(1);
            $first = false;
            $coords = $this->queryOne($q . ', India');
            if ($coords) return $coords;
        }

        log_message('warning', 'Geocode: no result for "{q}" (tried {n} variants)', ['q' => $candidates[0], 'n' => count($candidates)]);
        return null;
    }

    /** One Nominatim lookup for an exact query string. Null on any failure. */
    private function queryOne(string $query): ?array
    {
        $url = $this->endpoint . '?' . http_build_query([
            'q'            => $query,
            'format'       => 'json',
            'limit'        => 1,
            'countrycodes' => 'in',
        ]);

        try {
            $resp = $this->rawGet($url);
            if ($resp['code'] !== 200 || $resp['body'] === '') {
                log_message('warning', 'Geocode: HTTP {c} for "{q}" ({e})', ['c' => $resp['code'], 'q' => $query, 'e' => $resp['error']]);
                return null;
            }

            $data = json_decode($resp['body'], true);
            if (! is_array($data) || ! isset($data[0]['lat'], $data[0]['lon'])) {
                return null;
            }

            $lat = (float) $data[0]['lat'];
            $lng = (float) $data[0]['lon'];
            if ($lat === 0.0 && $lng === 0.0) {
                return null;
            }

            return ['lat' => $lat, 'lng' => $lng];
        } catch (\Throwable $e) {
            log_message('error', 'Geocode failed for "{q}": {m}', ['q' => $query, 'm' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Raw cURL GET with the same Windows-safe SSL handling as SmsAlertService /
     * FirebaseService (CI4's CURLRequest doesn't honour the CA bundle path
     * consistently). Verify is ON by default; set geocoding.ssl_verify=0 (dev
     * only) to disable. Falls back to writable/cacert.pem for the CA bundle.
     */
    private function rawGet(string $url): array
    {
        $sslVerify = ! in_array((string) env('geocoding.ssl_verify'), ['0', 'false', 'no'], true);
        $cacert    = env('firebase.cacert') ?: (rtrim(ROOTPATH, '/\\') . DIRECTORY_SEPARATOR . 'writable' . DIRECTORY_SEPARATOR . 'cacert.pem');

        $opts = [
            CURLOPT_HTTPHEADER     => [
                // Nominatim rejects requests without an identifying User-Agent.
                'User-Agent: SprithiMarketplace/1.0 (support@sprithi.com)',
                'Accept: application/json',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_CONNECTTIMEOUT => 6,
            CURLOPT_SSL_VERIFYPEER => $sslVerify,
            CURLOPT_SSL_VERIFYHOST => $sslVerify ? 2 : 0,
        ];
        if ($sslVerify && is_string($cacert) && is_file($cacert)) {
            $opts[CURLOPT_CAINFO] = $cacert;
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, $opts);
        $resp = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);

        return ['code' => $code, 'body' => is_string($resp) ? $resp : '', 'error' => $err];
    }
}
