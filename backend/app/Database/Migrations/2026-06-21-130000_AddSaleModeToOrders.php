<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddSaleModeToOrders extends Migration
{
    public function up()
    {
        // Vendor-entered Customer purchase type: 'online' | 'offline'. NULL for
        // regular online-checkout orders and QR purchases. Online customer
        // purchases also surface in the vendor Orders list; offline ones don't.
        if (! $this->db->fieldExists('sale_mode', 'orders')) {
            $this->forge->addColumn('orders', [
                'sale_mode' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 20,
                    'null'       => true,
                ],
            ]);
        }
    }

    public function down()
    {
        $this->forge->dropColumn('orders', 'sale_mode');
    }
}
