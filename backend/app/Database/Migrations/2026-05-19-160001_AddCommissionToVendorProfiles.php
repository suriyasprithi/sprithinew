<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddCommissionToVendorProfiles extends Migration
{
    public function up()
    {
        $this->forge->addColumn('vendor_profiles', [
            'commission_pct' => [
                'type'       => 'DECIMAL',
                'constraint' => '5,2',
                'default'    => 10.00,
                'after'      => 'vendor_category_id',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('vendor_profiles', 'commission_pct');
    }
}
