<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Image fields are stored as base64 data URLs. Even a 100 KB photo becomes a
 * ~133 KB string after base64 — which silently truncates in TEXT (64 KB) and
 * outright fails in VARCHAR(255). Migrate every image-bearing column to
 * LONGTEXT (4 GB) so uploads round-trip intact.
 */
class WidenAllImageColumns extends Migration
{
    public function up()
    {
        $this->db->query('ALTER TABLE vendor_categories MODIFY image LONGTEXT NULL');
        $this->db->query('ALTER TABLE vendor_profiles   MODIFY image LONGTEXT NULL');
        $this->db->query('ALTER TABLE products          MODIFY image LONGTEXT NULL');
        $this->db->query('ALTER TABLE product_variants  MODIFY image LONGTEXT NULL');
        $this->db->query('ALTER TABLE home_banners      MODIFY image_url LONGTEXT NULL');
    }

    public function down()
    {
        // Going back to the previous mix is risky (data loss if any row exceeds
        // the old limits), so down() just clears the safety net to NULL-able
        // TEXT — keep this no-op-safe in practice.
        $this->db->query('ALTER TABLE vendor_categories MODIFY image TEXT NULL');
        $this->db->query('ALTER TABLE vendor_profiles   MODIFY image VARCHAR(255) NULL');
        $this->db->query('ALTER TABLE products          MODIFY image TEXT NULL');
        $this->db->query('ALTER TABLE product_variants  MODIFY image VARCHAR(255) NULL');
        $this->db->query('ALTER TABLE home_banners      MODIFY image_url TEXT NULL');
    }
}
