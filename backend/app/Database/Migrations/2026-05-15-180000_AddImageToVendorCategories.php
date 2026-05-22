<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddImageToVendorCategories extends Migration
{
    public function up()
    {
        $this->forge->addColumn('vendor_categories', [
            'image' => [
                'type'       => 'TEXT',
                'null'       => true,
                'after'      => 'name',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('vendor_categories', 'image');
    }
}
