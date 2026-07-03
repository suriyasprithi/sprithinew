<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Flash sale: a vendor can put a product on a limited-time discount. The regular
 * `price` stays the "original" price; `flash_price` is the discounted price shown
 * while the sale window (flash_start..flash_end) is live. Discount % and savings
 * are computed, never stored. Stock reuses the existing `stock` column.
 */
class AddFlashSaleToProducts extends Migration
{
    public function up(): void
    {
        $fields = $this->db->getFieldNames('products');
        $add    = [];
        if (! in_array('flash_sale', $fields, true)) {
            $add['flash_sale'] = ['type' => 'TINYINT', 'constraint' => 1, 'null' => false, 'default' => 0, 'after' => 'mrp'];
        }
        if (! in_array('flash_price', $fields, true)) {
            $add['flash_price'] = ['type' => 'DECIMAL', 'constraint' => '12,2', 'null' => true, 'after' => 'flash_sale'];
        }
        if (! in_array('flash_start', $fields, true)) {
            $add['flash_start'] = ['type' => 'DATETIME', 'null' => true, 'after' => 'flash_price'];
        }
        if (! in_array('flash_end', $fields, true)) {
            $add['flash_end'] = ['type' => 'DATETIME', 'null' => true, 'after' => 'flash_start'];
        }
        if ($add) $this->forge->addColumn('products', $add);
    }

    public function down(): void
    {
        foreach (['flash_sale', 'flash_price', 'flash_start', 'flash_end'] as $col) {
            $this->forge->dropColumn('products', $col);
        }
    }
}
