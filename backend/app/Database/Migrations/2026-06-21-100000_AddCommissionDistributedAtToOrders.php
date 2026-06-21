<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Idempotency stamp for commission/buyback distribution. Set the first (and only)
 * time CommissionService::distributeForOrder runs for an order, so the wallet-at-
 * placement, paid, and COD-on-delivery triggers can never double-pay.
 */
class AddCommissionDistributedAtToOrders extends Migration
{
    public function up()
    {
        if (! $this->db->fieldExists('commission_distributed_at', 'orders')) {
            $this->forge->addColumn('orders', [
                'commission_distributed_at' => ['type' => 'DATETIME', 'null' => true, 'after' => 'status'],
            ]);
        }
    }

    public function down()
    {
        if ($this->db->fieldExists('commission_distributed_at', 'orders')) {
            $this->forge->dropColumn('orders', 'commission_distributed_at');
        }
    }
}
