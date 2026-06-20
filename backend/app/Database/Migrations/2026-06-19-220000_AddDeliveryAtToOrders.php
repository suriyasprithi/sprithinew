<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Scheduled delivery date+time chosen by the customer at checkout.
 * Drives the rule-based delivery charge (paid window by the chosen time-of-day;
 * free when the chosen time is more than delivery.free_above_hours ahead of now).
 */
class AddDeliveryAtToOrders extends Migration
{
    public function up()
    {
        if (! $this->db->fieldExists('delivery_at', 'orders')) {
            $this->forge->addColumn('orders', [
                'delivery_at' => ['type' => 'DATETIME', 'null' => true],
            ]);
        }
    }

    public function down()
    {
        if ($this->db->fieldExists('delivery_at', 'orders')) {
            $this->forge->dropColumn('orders', 'delivery_at');
        }
    }
}
