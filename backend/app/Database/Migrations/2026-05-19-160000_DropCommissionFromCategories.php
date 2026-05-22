<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class DropCommissionFromCategories extends Migration
{
    public function up()
    {
        if ($this->db->fieldExists('commission_pct', 'categories')) {
            $this->forge->dropColumn('categories', 'commission_pct');
        }
    }

    public function down()
    {
        $this->forge->addColumn('categories', [
            'commission_pct' => ['type' => 'DECIMAL', 'constraint' => '5,2', 'default' => 0, 'after' => 'name'],
        ]);
    }
}
