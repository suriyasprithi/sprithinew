<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddTokenCostToCategories extends Migration
{
    public function up()
    {
        $this->forge->addColumn('categories', [
            'token_cost' => [
                'type'    => 'INT',
                'unsigned'=> true,
                'default' => 1,
                'after'   => 'commission_pct',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('categories', 'token_cost');
    }
}
