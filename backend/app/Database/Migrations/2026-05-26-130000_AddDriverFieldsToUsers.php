<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddDriverFieldsToUsers extends Migration
{
    public function up()
    {
        $this->forge->addColumn('users', [
            'vehicle_number' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => true,
                'after'      => 'pincode',
            ],
            'license_number' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
                'after'      => 'vehicle_number',
            ],
            'monthly_salary' => [
                'type'       => 'DECIMAL',
                'constraint' => '12,2',
                'default'    => 0.00,
                'null'       => false,
                'after'      => 'license_number',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('users', ['vehicle_number', 'license_number', 'monthly_salary']);
    }
}
