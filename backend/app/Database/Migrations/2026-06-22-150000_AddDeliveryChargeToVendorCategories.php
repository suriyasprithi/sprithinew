<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Per-vendor-category delivery charge — the amount added when a shop's order in
 * this vendor category is BELOW its free-delivery threshold (free_delivery_min).
 * Sits alongside free_delivery_min: threshold = "free above ₹X", charge = "else ₹Y".
 */
class AddDeliveryChargeToVendorCategories extends Migration
{
    public function up()
    {
        $this->forge->addColumn('vendor_categories', [
            'delivery_charge' => [
                'type'       => 'DECIMAL',
                'constraint' => '10,2',
                'default'    => 0,
                'after'      => 'free_delivery_min',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('vendor_categories', 'delivery_charge');
    }
}
