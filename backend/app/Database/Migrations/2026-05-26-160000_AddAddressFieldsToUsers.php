<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddAddressFieldsToUsers extends Migration
{
    public function up()
    {
        $this->forge->addColumn('users', [
            'address_line' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
                'after'      => 'pincode',
            ],
            'landmark' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
                'null'       => true,
                'after'      => 'address_line',
            ],
            'city' => [
                'type'       => 'VARCHAR',
                'constraint' => 80,
                'null'       => true,
                'after'      => 'landmark',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('users', ['address_line', 'landmark', 'city']);
    }
}
