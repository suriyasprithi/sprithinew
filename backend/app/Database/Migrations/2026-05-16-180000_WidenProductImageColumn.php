<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * The original products.image is VARCHAR(255). That's too short to hold
 * inline data URLs (an emoji SVG comes out to ~380 bytes after base64).
 * Switch to TEXT so any data URL or external URL fits.
 */
class WidenProductImageColumn extends Migration
{
    public function up()
    {
        $this->db->query('ALTER TABLE products MODIFY image TEXT NULL');
    }

    public function down()
    {
        $this->db->query('ALTER TABLE products MODIFY image VARCHAR(255) NULL');
    }
}
