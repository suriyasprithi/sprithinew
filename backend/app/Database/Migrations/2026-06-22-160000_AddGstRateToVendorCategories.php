<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Per-vendor-category GST rate (percent). The tax breakup shown at cart/checkout
 * is computed per line as subtotal × gst_rate / 100. Default 0 → no GST is shown
 * or charged until an admin sets a rate on the vendor category (BUG-014).
 */
class AddGstRateToVendorCategories extends Migration
{
    public function up()
    {
        $this->forge->addColumn('vendor_categories', [
            'gst_rate' => [
                'type'       => 'DECIMAL',
                'constraint' => '5,2',
                'default'    => 0,
                'after'      => 'delivery_charge',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('vendor_categories', 'gst_rate');
    }
}
