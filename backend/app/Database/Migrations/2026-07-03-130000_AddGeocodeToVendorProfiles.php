<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Vendor geocoding. The shop address (address + area + pincode) is converted to
 * lat/lng via OpenStreetMap Nominatim so customers can see how far each vendor
 * is. Coordinates are stored, never computed per request.
 *
 *   latitude / longitude  DECIMAL(10,7)  — ~1cm precision, enough for a shop
 *   geocoded_at           last successful lookup
 *   geocode_hash          md5 of the address parts; we only re-geocode when the
 *                         address actually changes (see GeocodingService::hash)
 */
class AddGeocodeToVendorProfiles extends Migration
{
    public function up(): void
    {
        $fields = $this->db->getFieldNames('vendor_profiles');
        $add    = [];
        if (! in_array('latitude', $fields, true)) {
            $add['latitude'] = ['type' => 'DECIMAL', 'constraint' => '10,7', 'null' => true, 'after' => 'pincode'];
        }
        if (! in_array('longitude', $fields, true)) {
            $add['longitude'] = ['type' => 'DECIMAL', 'constraint' => '10,7', 'null' => true, 'after' => 'latitude'];
        }
        if (! in_array('geocoded_at', $fields, true)) {
            $add['geocoded_at'] = ['type' => 'DATETIME', 'null' => true, 'after' => 'longitude'];
        }
        if (! in_array('geocode_hash', $fields, true)) {
            $add['geocode_hash'] = ['type' => 'VARCHAR', 'constraint' => 64, 'null' => true, 'after' => 'geocoded_at'];
        }
        if ($add) $this->forge->addColumn('vendor_profiles', $add);
    }

    public function down(): void
    {
        foreach (['latitude', 'longitude', 'geocoded_at', 'geocode_hash'] as $col) {
            $this->forge->dropColumn('vendor_profiles', $col);
        }
    }
}
