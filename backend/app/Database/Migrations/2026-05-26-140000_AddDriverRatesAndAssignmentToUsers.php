<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddDriverRatesAndAssignmentToUsers extends Migration
{
    public function up()
    {
        $this->forge->addColumn('users', [
            'km_rate' => [
                'type'       => 'DECIMAL',
                'constraint' => '8,2',
                'default'    => 0.00,
                'null'       => false,
                'after'      => 'monthly_salary',
            ],
            'hour_rate' => [
                'type'       => 'DECIMAL',
                'constraint' => '8,2',
                'default'    => 0.00,
                'null'       => false,
                'after'      => 'km_rate',
            ],
            'taluk_id' => [
                'type'       => 'INT',
                'constraint' => 10,
                'unsigned'   => true,
                'null'       => true,
                'after'      => 'hour_rate',
            ],
            'assigned_vendor_id' => [
                'type'       => 'BIGINT',
                'constraint' => 20,
                'unsigned'   => true,
                'null'       => true,
                'after'      => 'taluk_id',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('users', ['km_rate', 'hour_rate', 'taluk_id', 'assigned_vendor_id']);
    }
}
