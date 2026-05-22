<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Buyback commission rows use negative `level` values (-1..-4) to distinguish
 * them from MLM L1/L2/L3 rows. The original migration made the column unsigned,
 * which silently clamped negatives to 0. Make it signed so the tag survives.
 */
class PurchaseCommissionsAllowSignedLevel extends Migration
{
    public function up()
    {
        $this->db->query('ALTER TABLE purchase_commissions MODIFY level TINYINT NOT NULL');
    }

    public function down()
    {
        $this->db->query('ALTER TABLE purchase_commissions MODIFY level TINYINT UNSIGNED NOT NULL');
    }
}
