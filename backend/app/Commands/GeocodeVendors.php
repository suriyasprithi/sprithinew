<?php

namespace App\Commands;

use App\Models\VendorProfileModel;
use App\Services\GeocodingService;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

/**
 * Backfill / refresh vendor lat-lng from their shop address via Nominatim.
 *
 *   php spark vendors:geocode              # only vendors missing coords or whose address changed
 *   php spark vendors:geocode --all        # re-geocode every vendor (ignores the hash)
 *   php spark vendors:geocode --limit 50   # cap the number geocoded this run
 *
 * Honours Nominatim's ~1 req/sec policy (sleeps 1s between lookups). Failures are
 * logged and skipped; the vendor keeps whatever coordinates it already had.
 * Idempotent: re-running only touches vendors whose address changed since last time.
 */
class GeocodeVendors extends BaseCommand
{
    protected $group       = 'Vendors';
    protected $name        = 'vendors:geocode';
    protected $description = 'Geocode vendor shop addresses to lat/lng (OpenStreetMap Nominatim).';
    protected $usage       = 'vendors:geocode [--all] [--limit N]';
    protected $options     = [
        '--all'   => 'Re-geocode every vendor, ignoring the stored address hash.',
        '--limit' => 'Stop after geocoding this many vendors.',
    ];

    public function run(array $params)
    {
        $all   = array_key_exists('all', $params) || CLI::getOption('all');
        $limit = (int) (CLI::getOption('limit') ?? 0);

        $model = new VendorProfileModel();
        $geo   = new GeocodingService();

        $rows = $model->findAll();
        $ok = $fail = $skip = $done = 0;

        foreach ($rows as $p) {
            if ($limit > 0 && $done >= $limit) break;

            $address = (string) ($p['address'] ?? '');
            $area    = (string) ($p['area'] ?? '');
            $pincode = (string) ($p['pincode'] ?? '');
            if (trim($address . $area . $pincode) === '') { $skip++; continue; }

            $hash      = GeocodingService::hash($address, $area, $pincode);
            $hasCoords = ! empty($p['latitude']) && ! empty($p['longitude']);
            // Already geocoded for this exact address → skip unless --all.
            if (! $all && $hasCoords && ($p['geocode_hash'] ?? '') === $hash) { $skip++; continue; }

            $done++;
            $shop   = $p['shop_name'] ?? ('#' . $p['user_id']);
            $coords = $geo->geocode($address, $area, $pincode);

            if ($coords) {
                $model->update((int) $p['user_id'], [
                    'latitude'     => $coords['lat'],
                    'longitude'    => $coords['lng'],
                    'geocoded_at'  => date('Y-m-d H:i:s'),
                    'geocode_hash' => $hash,
                ]);
                $ok++;
                CLI::write("  ✓ {$shop} → {$coords['lat']}, {$coords['lng']}", 'green');
            } else {
                $fail++;
                CLI::write("  ✗ {$shop} — no result (kept existing coords)", 'yellow');
            }

            sleep(1); // Nominatim: max ~1 request/second.
        }

        CLI::newLine();
        CLI::write("Geocoded: {$ok} ok, {$fail} failed, {$skip} skipped.", 'white');
        return 0;
    }
}
