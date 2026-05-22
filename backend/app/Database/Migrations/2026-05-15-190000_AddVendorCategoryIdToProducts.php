<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddVendorCategoryIdToProducts extends Migration
{
    public function up()
    {
        $this->forge->addColumn('products', [
            'vendor_category_id' => [
                'type'     => 'INT',
                'unsigned' => true,
                'null'     => true,
                'after'    => 'category_id',
            ],
        ]);
        $this->db->query("ALTER TABLE products ADD INDEX idx_vendor_category_id (vendor_category_id)");
    }

    public function down()
    {
        $this->db->query("ALTER TABLE products DROP INDEX idx_vendor_category_id");
        $this->forge->dropColumn('products', 'vendor_category_id');
    }
}
