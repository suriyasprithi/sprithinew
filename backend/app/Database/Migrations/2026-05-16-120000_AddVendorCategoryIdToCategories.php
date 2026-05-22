<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddVendorCategoryIdToCategories extends Migration
{
    public function up()
    {
        $this->forge->addColumn('categories', [
            'vendor_category_id' => [
                'type'     => 'INT',
                'unsigned' => true,
                'null'     => true,
                'after'    => 'commission_pct',
            ],
        ]);
        $this->db->query('ALTER TABLE categories ADD INDEX idx_vendor_category_id (vendor_category_id)');
    }

    public function down()
    {
        $this->db->query('ALTER TABLE categories DROP INDEX idx_vendor_category_id');
        $this->forge->dropColumn('categories', 'vendor_category_id');
    }
}
