<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Track WHO cancelled an order ('customer' | 'vendor') so each side's app can
 * label the cancellation correctly and show the other party's reason:
 *   - customer cancels → vendor sees "cancelled by customer" + reason
 *   - vendor cancels   → customer sees "cancelled by the shop" + reason
 */
class AddCancelledByToOrders extends Migration
{
    public function up()
    {
        if (! $this->db->fieldExists('cancelled_by', 'orders')) {
            $this->forge->addColumn('orders', [
                'cancelled_by' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 20,
                    'null'       => true,
                    'after'      => 'cancel_reason',
                ],
            ]);
        }
    }

    public function down()
    {
        if ($this->db->fieldExists('cancelled_by', 'orders')) {
            $this->forge->dropColumn('orders', 'cancelled_by');
        }
    }
}
