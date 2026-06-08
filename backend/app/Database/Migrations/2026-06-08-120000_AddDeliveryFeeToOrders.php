<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddDeliveryFeeToOrders extends Migration
{
    // Stores the delivery fee charged to the customer at checkout (chosen from
    // the taluk's delivery_time_rates). order.total now = items_subtotal +
    // delivery_fee; vendor/commission math reads items_subtotal as
    // (total - delivery_fee). The chosen time is stored in the existing
    // `delivery_minutes` column.
    public function up()
    {
        if (! $this->db->fieldExists('delivery_fee', 'orders')) {
            $this->forge->addColumn('orders', [
                'delivery_fee' => [
                    'type'       => 'DECIMAL',
                    'constraint' => '10,2',
                    'default'    => 0.00,
                    'after'      => 'total',
                ],
            ]);
        }
    }

    public function down()
    {
        if ($this->db->fieldExists('delivery_fee', 'orders')) {
            $this->forge->dropColumn('orders', 'delivery_fee');
        }
    }
}
