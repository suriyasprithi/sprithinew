<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Driver ID-card image, stored as a base64 data URL (same approach as
 * home_banners.image_url), so a LONGTEXT column is needed.
 */
class AddDriverIdCardUrl extends Migration
{
    public function up()
    {
        if (! $this->db->fieldExists('id_card_url', 'users')) {
            $this->db->query('ALTER TABLE users ADD COLUMN id_card_url LONGTEXT NULL');
        }
    }

    public function down()
    {
        if ($this->db->fieldExists('id_card_url', 'users')) {
            $this->db->query('ALTER TABLE users DROP COLUMN id_card_url');
        }
    }
}
