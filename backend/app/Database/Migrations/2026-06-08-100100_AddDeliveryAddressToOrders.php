<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddDeliveryAddressToOrders extends Migration
{
    // The legacy import already adds `orders.delivery_address` (VARCHAR 1000),
    // which we reuse as the per-order address snapshot. This migration only
    // adds it on a fresh DB that lacks the legacy column.
    public function up()
    {
        if (! $this->db->fieldExists('delivery_address', 'orders')) {
            $this->forge->addColumn('orders', [
                'delivery_address' => [
                    'type'  => 'TEXT',
                    'null'  => true,
                    'after' => 'notes',
                ],
            ]);
        }
    }

    public function down()
    {
        // No-op: the column may predate this migration (legacy import), so we
        // never drop it here.
    }
}
