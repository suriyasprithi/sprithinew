<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddPrescriptionToOrders extends Migration
{
    public function up()
    {
        $this->forge->addColumn('orders', [
            'prescription_path' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
                'after'      => 'delivery_address',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('orders', 'prescription_path');
    }
}
