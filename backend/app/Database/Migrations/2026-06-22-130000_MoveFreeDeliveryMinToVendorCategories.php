<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Free-delivery threshold moves from PRODUCT categories to VENDOR categories.
 * Each vendor category inherits the highest threshold among its product
 * categories, then the per-product-category column is dropped.
 */
class MoveFreeDeliveryMinToVendorCategories extends Migration
{
    public function up()
    {
        $this->forge->addColumn('vendor_categories', [
            'free_delivery_min' => [
                'type'       => 'DECIMAL',
                'constraint' => '10,2',
                'default'    => 0,
                'after'      => 'status',
            ],
        ]);

        // Carry existing values over: a vendor category takes the max threshold
        // set on any of its product categories (so nothing configured is lost).
        $this->db->query(
            'UPDATE vendor_categories vc
             SET free_delivery_min = (
                 SELECT COALESCE(MAX(c.free_delivery_min), 0)
                 FROM categories c
                 WHERE c.vendor_category_id = vc.id
             )'
        );

        $this->forge->dropColumn('categories', 'free_delivery_min');
    }

    public function down()
    {
        $this->forge->addColumn('categories', [
            'free_delivery_min' => [
                'type'       => 'DECIMAL',
                'constraint' => '10,2',
                'default'    => 0,
                'after'      => 'status',
            ],
        ]);
        // Best-effort restore: push each vendor category's threshold back down to
        // its product categories.
        $this->db->query(
            'UPDATE categories c
             JOIN vendor_categories vc ON vc.id = c.vendor_category_id
             SET c.free_delivery_min = vc.free_delivery_min'
        );
        $this->forge->dropColumn('vendor_categories', 'free_delivery_min');
    }
}
